"""Seed loading (Backend Spec §5). Idempotent: safe to run on every startup.

Loads the five-campaign demo world from data/*.json — entities, relationships,
reports, messages, and false-positive corrections — resolving references by
value, then recomputes rule-based risk so stored scores match what a scan
produces. Clusters and sources are defined here (small, stable).
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from services.common import new_id
from services.entity_extractor import normalize_entity

DATA = Path(__file__).resolve().parent.parent / "data"

# 5 scam clusters (campaigns). Entities reference these by name.
CLUSTERS = {
    "Fake OKX Airdrop": "cluster_okx",
    "Fake Binance Support": "cluster_binance",
    "WhatsApp Investment Scam": "cluster_whatsapp",
    "Rug Pull Token": "cluster_rugpull",
    "Fake MetaMask Verification": "cluster_metamask",
}

# Evidence sources. `public_feed` sources trigger the +30 public-scam-source
# signal; `whitelist` triggers the -30 legitimate-source signal.
SOURCES = {
    "chainabuse": ("Chainabuse", "public_feed", 0.9),
    "cryptoscamdb": ("CryptoScamDB", "public_feed", 0.9),
    "phishtank": ("PhishTank", "public_feed", 0.85),
    "community": ("Community report", "user_report", 0.6),
    "internal": ("Internal graph", "derived", 0.85),
    "whitelist": ("Verified whitelist", "whitelist", 0.95),
    "demo_seed": ("Demo seed", "seed", 0.7),
}

_LABEL = {"critical": "Critical", "high": "High Risk", "suspicious": "Suspicious", "low": "Low Risk"}
_LABEL_SCORE = {"critical": 10, "high": 30, "suspicious": 55, "low": 90}  # safety scores


SNAPSHOT = DATA / "db_snapshot.json"


def _load(name: str) -> list[dict]:
    path = DATA / name
    return json.loads(path.read_text()) if path.exists() else []


def _parse_dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None


def load_snapshot(db: Session) -> dict:
    """Load the exported threat-intel snapshot (scripts/export_snapshot.py).

    Production SQLite is ephemeral, so the full locally-built dataset ships in
    the repo and is reloaded here on every boot. Idempotent by entity value:
    entities that already exist (demo seed, earlier runs) are left untouched
    and their snapshot reports/relationships skipped.
    """
    if not SNAPSHOT.exists():
        return {"entities": 0, "reports": 0, "relationships": 0}
    snap = json.loads(SNAPSHOT.read_text())

    existing = {v: i for i, v in db.execute(select(models.Entity.id, models.Entity.value))}
    clusters = {c for (c,) in db.execute(select(models.Cluster.id))}
    sources = {s for (s,) in db.execute(select(models.Source.id))}
    counts = {"entities": 0, "reports": 0, "relationships": 0}

    new_values: set[str] = set()
    for e in snap.get("entities", []):
        if e["value"] in existing:
            continue
        eid = new_id("ent")
        db.add(models.Entity(
            id=eid,
            entity_type=e["entity_type"],
            value=e["value"],
            chain=e.get("chain"),
            status=e.get("status", "verified"),
            risk_label=e.get("risk_label", "Unknown"),
            risk_score=e.get("risk_score"),
            confidence=e.get("confidence"),
            cluster_id=e.get("cluster_id") if e.get("cluster_id") in clusters else None,
            first_seen=_parse_dt(e.get("first_seen")) or _now(),
            last_seen=_parse_dt(e.get("last_seen")) or _now(),
        ))
        existing[e["value"]] = eid
        new_values.add(e["value"])
        counts["entities"] += 1
    db.flush()

    for r in snap.get("reports", []):
        if r["entity_value"] not in new_values:
            continue
        src = r.get("source_id")
        db.add(models.Report(
            id=new_id("rpt"),
            entity_id=existing[r["entity_value"]],
            source_id=src if src in sources else "community",
            scam_type=r.get("scam_type", "other"),
            description=r.get("description", ""),
            evidence=r.get("evidence"),
            confidence=r.get("confidence", 0.6),
            status=r.get("status", "pending"),
            reporter=r.get("reporter"),
            created_at=_parse_dt(r.get("created_at")) or _now(),
        ))
        counts["reports"] += 1

    for rel in snap.get("relationships", []):
        a, b = existing.get(rel["from_value"]), existing.get(rel["to_value"])
        if not a or not b:
            continue
        if rel["from_value"] not in new_values and rel["to_value"] not in new_values:
            continue  # both endpoints pre-existed — relationship came from seed
        db.add(models.Relationship(
            from_entity_id=a, to_entity_id=b,
            relationship_type=rel.get("relationship_type", "related"),
            confidence=rel.get("confidence", 0.5),
            evidence=rel.get("evidence"),
        ))
        counts["relationships"] += 1

    db.commit()
    return counts


def _now(offset_min: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(minutes=offset_min)


def load_seed(db: Session) -> None:
    if db.scalar(select(models.Entity).limit(1)):
        return  # already seeded

    # Clusters + sources
    for name, cid in CLUSTERS.items():
        db.add(models.Cluster(id=cid, value=name, risk_label="Critical"))
    for key, (nm, stype, rel) in SOURCES.items():
        db.add(models.Source(id=key, name=nm, source_type=stype, reliability_score=rel))
    db.flush()

    # Entities (raw value -> id, so seed refs resolve consistently)
    value_to_id: dict[str, str] = {}
    for e in _load("seed_entities.json"):
        raw = e["value"]
        norm = normalize_entity(raw, e["entity_type"])
        eid = new_id("ent")
        db.add(models.Entity(
            id=eid,
            entity_type=e["entity_type"],
            value=norm,
            chain=e.get("chain"),
            status=e.get("status", "flagged"),
            risk_label=_LABEL.get(e.get("risk_label", "low"), "Unknown"),
            risk_score=_LABEL_SCORE.get(e.get("risk_label", "low")),
            confidence=e.get("confidence"),
            cluster_id=CLUSTERS.get(e.get("cluster")),
            first_seen=_now(60 * 24 * 12),
            last_seen=_now(60 * 24),
        ))
        value_to_id[raw] = eid
        value_to_id[norm] = eid
    db.flush()

    def resolve(v: str) -> str | None:
        return value_to_id.get(v) or value_to_id.get(v.lower())

    # Relationships (resolved by value)
    for r in _load("seed_relationships.json"):
        a, b = resolve(r["from_value"]), resolve(r["to_value"])
        if a and b:
            db.add(models.Relationship(
                from_entity_id=a, to_entity_id=b,
                relationship_type=r["relationship_type"],
                confidence=r.get("confidence", 0.5), evidence=r.get("evidence"),
            ))

    # Reports (resolved by value; source key -> Source row)
    for i, rp in enumerate(_load("seed_reports.json")):
        eid = resolve(rp["entity_value"])
        if not eid:
            continue
        src = rp.get("source", "community")
        db.add(models.Report(
            id=new_id("rpt"), entity_id=eid,
            source_id=src if src in SOURCES else "community",
            scam_type=rp.get("scam_type", "other"),
            description=rp.get("description", ""),
            evidence=rp.get("evidence"),
            confidence=rp.get("confidence", 0.6),
            status=rp.get("status", "pending"),
            created_at=_now(30 + i * 17),
        ))

    # Messages: enrich the message entity with its full text.
    for m in _load("seed_messages.json"):
        eid = resolve(m["message_id"])
        if eid:
            ent = db.get(models.Entity, eid)
            if ent:
                ent.status = "flagged"

    db.flush()

    # False-positive corrections -> flip the entity's report, record a forget
    # event, and mark the entity cleared. Drives the "forget" story + stat.
    for c in _load("seed_corrections.json"):
        eid = resolve(c["entity_value"])
        if not eid:
            continue
        rpt = db.scalar(select(models.Report).where(models.Report.entity_id == eid))
        old_status = rpt.status if rpt else "pending"
        if rpt:
            rpt.status = "false_positive"
        ent = db.get(models.Entity, eid)
        if ent:
            ent.status = "cleared"
        db.add(models.ForgetEvent(
            entity_id=eid, report_id=rpt.id if rpt else None,
            reason="false_positive", old_status=old_status, new_status="cleared",
        ))
        db.add(models.MemoryEvent(
            id=new_id("mem"), event_type="forget", entity_id=eid,
            summary=f"Forgot false-positive claim ({c['reason'][:60]})",
            reason="Admin review cleared this entity; -50 correction applied.",
            created_at=_now(20),
        ))
    db.flush()

    # Recompute risk from rules (two passes so neighbour scores populate first).
    from services.risk_engine import calculate_risk

    all_entities = db.scalars(select(models.Entity)).all()
    for _ in range(2):
        for ent in all_entities:
            v = calculate_risk(db, ent)
            ent.risk_score, ent.risk_label, ent.confidence = v["score"], v["label"], v["confidence"]
        db.flush()

    # A few scan events + a seed improve event for dashboard activity.
    heroes = [
        ("claim-okx-reward-demo.com", "domain", 6),
        ("binance-wallet-verify-demo.com", "domain", 24),
        ("metamask-wallet-verify.com", "domain", 60),
        ("rugpull-demo-token.com", "domain", 130),
    ]
    for i, (val, typ, age) in enumerate(heroes):
        eid = resolve(val)
        ent = db.get(models.Entity, eid) if eid else None
        if ent:
            db.add(models.ScanEvent(
                id=f"scan_seed_{i}", input_value=ent.value, input_type=typ,
                entity_id=eid, risk_score=ent.risk_score or 0, risk_label=ent.risk_label,
                confidence=ent.confidence or 0.8, explanation_json="{}", created_at=_now(age),
            ))
    db.add(models.MemoryEvent(
        id="mem_seed_improve", event_type="improve", entity_id=resolve("claim-okx-reward-demo.com"),
        summary="Linked entities across 5 campaigns into scam clusters",
        reason="Enrichment matched shared wallets, domains, and deployer patterns.",
        created_at=_now(45),
    ))

    db.commit()
