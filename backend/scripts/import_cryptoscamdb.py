"""Import the CryptoScamDB blacklist as real threat intel (entities + reports).

AEGIS has no ML model to "train" — it's a rule-based engine over a graph DB plus
Cognee memory. So this ingests real indicators of compromise (IOCs) from the
public CryptoScamDB blacklist into the same tables the demo seed uses, tied to
the already-seeded `cryptoscamdb` source (public_feed, reliability 0.9). Those
reports then fire the existing "Listed in a public scam source" (+30) signal in
services/risk_engine.py — no scoring changes needed.

Source repo:  https://github.com/CryptoScamDB/blacklist
  data/urls.yaml    — thousands of malicious domains/URLs (list of objects)
  data/uris.yaml    — additional URIs (same schema)
  data/twitter.json — id -> suspicious twitter handle
Each yaml entry: {name, url, category, subcategory, description,
                  addresses: {COIN: [addr, ...]}, reporter}

Usage (from backend/):
  python scripts/import_cryptoscamdb.py                 # ~1000 entries, + Cognee
  python scripts/import_cryptoscamdb.py --limit 250     # smaller sample
  python scripts/import_cryptoscamdb.py --no-cognee     # DB only
  python scripts/import_cryptoscamdb.py --refresh       # re-clone the dataset
"""
from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import yaml  # noqa: E402
from sqlalchemy import select  # noqa: E402

import models  # noqa: E402
from config import settings  # noqa: E402
from database import SessionLocal, init_db  # noqa: E402
from services import cognee_service  # noqa: E402
from services.common import new_id  # noqa: E402
from services.entity_extractor import detect_entity_type, normalize_entity  # noqa: E402
from services.risk_engine import calculate_risk  # noqa: E402

REPO_URL = "https://github.com/CryptoScamDB/blacklist"
DEFAULT_DIR = Path(__file__).resolve().parent.parent / "data" / "external" / "cryptoscamdb"
SOURCE_ID = "cryptoscamdb"  # already defined in ingestion_service.SOURCES

# CryptoScamDB category/subcategory -> AEGIS scam type (frontend SCAM_TYPES).
_SCAM_TYPE = {
    "phishing": "Phishing",
    "fake ico": "Investment Scam",
    "scamming": "Other",
    "airdrop": "Fake Airdrop",
    "drainer": "Wallet Drainer",
    "impersonation": "Impersonation",
    "support": "Fake Support",
}
# Coin symbol -> chain label.
_CHAIN = {
    "ETH": "ethereum", "BTC": "bitcoin", "BCH": "bitcoin-cash", "LTC": "litecoin",
    "ETC": "ethereum-classic", "XRP": "ripple", "BNB": "bsc", "TRX": "tron",
}


def scam_type_for(category: str | None, subcategory: str | None) -> str:
    blob = f"{category or ''} {subcategory or ''}".lower()
    for key, val in _SCAM_TYPE.items():
        if key in blob:
            return val
    return "Other"


# ---------------------------------------------------------------- fetch dataset
def ensure_dataset(src_dir: Path, refresh: bool) -> Path:
    """Clone (or reuse) the blacklist repo; return its data/ directory."""
    data_dir = src_dir / "data"
    if refresh and src_dir.exists():
        print(f"  --refresh: removing {src_dir}")
        subprocess.run(["rm", "-rf", str(src_dir)], check=True)
    if not data_dir.exists():
        src_dir.parent.mkdir(parents=True, exist_ok=True)
        print(f"  cloning {REPO_URL} (shallow) …")
        subprocess.run(
            ["git", "clone", "--depth", "1", REPO_URL, str(src_dir)],
            check=True,
        )
    else:
        print(f"  reusing cached dataset at {src_dir}")
    return data_dir


def _iter_yaml_entries(text: str) -> tuple[list[dict], int]:
    """Parse a top-level YAML block-sequence resiliently.

    The blacklist files contain a few misindented/duplicate entries that make a
    whole-file yaml.safe_load fail. We split on top-level `- ` list markers and
    parse each item block on its own, skipping (counting) the malformed ones.
    """
    blocks: list[str] = []
    current: list[str] = []
    for line in text.splitlines():
        if line.startswith("- "):  # new top-level item
            if current:
                blocks.append("\n".join(current))
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append("\n".join(current))

    entries: list[dict] = []
    bad = 0
    for block in blocks:
        try:
            parsed = yaml.safe_load(block)
        except yaml.YAMLError:
            bad += 1
            continue
        if isinstance(parsed, list):
            entries.extend(x for x in parsed if isinstance(x, dict))
    return entries, bad


def load_entries(data_dir: Path) -> list[dict]:
    """Merge urls.yaml + uris.yaml into one list of entry dicts."""
    entries: list[dict] = []
    total_bad = 0
    for name in ("urls.yaml", "uris.yaml"):
        path = data_dir / name
        if not path.exists():
            continue
        found, bad = _iter_yaml_entries(path.read_text())
        entries.extend(found)
        total_bad += bad
    if total_bad:
        print(f"  skipped {total_bad} malformed yaml blocks")
    return entries


def load_handles(data_dir: Path) -> list[str]:
    path = data_dir / "twitter.json"
    if not path.exists():
        return []
    raw = json.loads(path.read_text())
    return sorted({str(v).lstrip("@") for v in raw.values() if v})


# ---------------------------------------------------------------- import into DB
def run_import(limit: int, refresh: bool, src_dir: Path) -> tuple[list[str], dict]:
    """Insert entities/reports/relationships. Returns (new_entity_ids, counts)."""
    data_dir = ensure_dataset(src_dir, refresh)
    entries = load_entries(data_dir)[:limit]
    handles = load_handles(data_dir)
    print(f"  parsed {len(entries)} url/uri entries + {len(handles)} handles "
          f"(applying limit={limit})")

    db = SessionLocal()
    counts = {"entities": 0, "wallets": 0, "reports": 0, "relationships": 0, "skipped": 0}
    new_ids: list[str] = []

    try:
        # Ensure the cryptoscamdb source row exists (normally seeded already).
        if not db.get(models.Source, SOURCE_ID):
            db.add(models.Source(
                id=SOURCE_ID, name="CryptoScamDB", source_type="public_feed",
                reliability_score=0.9,
            ))
            db.flush()

        # Preload existing values so we dedupe (Entity.value is UNIQUE).
        cache: dict[str, str] = {
            v: i for i, v in db.execute(select(models.Entity.id, models.Entity.value))
        }
        # Entities that already carry a cryptoscamdb report — don't double-report.
        reported: set[str] = {
            r for (r,) in db.execute(
                select(models.Report.entity_id).where(models.Report.source_id == SOURCE_ID)
            )
        }

        def upsert(value: str, etype: str, chain: str | None) -> str | None:
            norm = normalize_entity(value, etype) if value.startswith("0x") or etype != "wallet" else value.strip()
            if not norm:
                return None
            if norm in cache:
                counts["skipped"] += 1
                return cache[norm]
            eid = new_id("ent")
            db.add(models.Entity(
                id=eid, entity_type=etype, value=norm, chain=chain,
                status="verified", risk_label="Unknown", risk_score=None,
                confidence=0.9,
            ))
            cache[norm] = eid
            new_ids.append(eid)
            counts["wallets" if etype == "wallet" else "entities"] += 1
            return eid

        def add_report(eid: str, scam_type: str, desc: str, reporter: str | None) -> None:
            if eid in reported:
                return
            reported.add(eid)
            db.add(models.Report(
                id=new_id("rpt"), entity_id=eid, source_id=SOURCE_ID,
                scam_type=scam_type, description=desc or "Listed in CryptoScamDB blacklist.",
                evidence=f"CryptoScamDB blacklist entry (reporter: {reporter or 'CryptoScamDB'}).",
                confidence=0.9, status="verified", reporter=reporter or "CryptoScamDB",
            ))
            counts["reports"] += 1

        for e in entries:
            name = (e.get("name") or e.get("url") or "").strip()
            if not name:
                continue
            etype = detect_entity_type(name)
            if etype not in {"domain", "url"}:
                etype = "domain"
            eid = upsert(name, etype, None)
            if not eid:
                continue
            scam_type = scam_type_for(e.get("category"), e.get("subcategory"))
            desc = e.get("description") or f"{e.get('category', 'Scam')} — {e.get('subcategory', '')}".strip(" —")
            add_report(eid, scam_type, desc, e.get("reporter"))

            # Linked payment addresses -> wallet entities + relationship.
            for coin, addrs in (e.get("addresses") or {}).items():
                for addr in addrs or []:
                    if not addr:
                        continue
                    wid = upsert(str(addr), "wallet", _CHAIN.get(coin.upper()))
                    if wid and wid != eid:
                        db.add(models.Relationship(
                            from_entity_id=eid, to_entity_id=wid,
                            relationship_type="payment_address", confidence=0.9,
                            evidence=f"CryptoScamDB linked {coin} address.",
                        ))
                        counts["relationships"] += 1

        for h in handles:
            hid = upsert(f"@{h}", "handle", None)
            if hid:
                add_report(hid, "Impersonation", f"Suspicious account @{h} listed in CryptoScamDB.", "CryptoScamDB")

        db.flush()

        # Score just the newly-added entities via the real engine (explainable).
        print(f"  scoring {len(new_ids)} new entities …")
        for eid in new_ids:
            ent = db.get(models.Entity, eid)
            if ent:
                v = calculate_risk(db, ent)
                ent.risk_score, ent.risk_label, ent.confidence = v["score"], v["label"], v["confidence"]

        db.commit()
    finally:
        db.close()

    return new_ids, counts


# ---------------------------------------------------------------- Cognee push
async def push_to_cognee(new_ids: list[str]) -> None:
    if not settings.cognee_enabled:
        print("  Cognee not configured — skipping memory push.")
        return
    db = SessionLocal()
    ok = fail = 0
    try:
        print(f"  pushing {len(new_ids)} entities into Cognee memory …")
        for n, eid in enumerate(new_ids, 1):
            e = db.get(models.Entity, eid)
            if not e:
                continue
            text = (
                f"{e.entity_type.title()} {e.value} is a known scam "
                f"({e.risk_label}, safety {e.risk_score}/100), reported by "
                f"CryptoScamDB public threat feed."
            )
            res = await cognee_service.remember_note(text, node_set="threat_intel")
            ok += res.get("ok") is True
            fail += res.get("ok") is not True
            if n % 100 == 0:
                print(f"    … {n}/{len(new_ids)} ({ok} ok, {fail} failed)")
    finally:
        db.close()
    print(f"  Cognee push complete — {ok} remembered, {fail} failed.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Import CryptoScamDB blacklist into AEGIS.")
    ap.add_argument("--limit", type=int, default=1000, help="Max url/uri entries to import (default 1000).")
    ap.add_argument("--no-cognee", action="store_true", help="Skip pushing to Cognee memory.")
    ap.add_argument("--refresh", action="store_true", help="Re-clone the dataset before importing.")
    ap.add_argument("--source-dir", type=Path, default=DEFAULT_DIR, help="Where to clone/read the blacklist repo.")
    args = ap.parse_args()

    print("Importing CryptoScamDB blacklist …")
    init_db()
    new_ids, counts = run_import(args.limit, args.refresh, args.source_dir)

    print("\nImport summary:")
    for k, v in counts.items():
        print(f"  {k:14} {v}")
    print(f"  {'new total':14} {len(new_ids)} entities scored")

    if not args.no_cognee and new_ids:
        asyncio.run(push_to_cognee(new_ids))

    print("\nDone.")


if __name__ == "__main__":
    main()
