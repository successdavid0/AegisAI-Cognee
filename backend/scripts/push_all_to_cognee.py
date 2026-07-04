"""Mirror the ENTIRE AEGIS database into Cognee as durable memory.

The user wants Cognee to act as the storage/knowledge point of record, holding
every record — not just entities. This walks every table and pushes one
natural-language note per row into Cognee (each table -> its own node_set), so
the full graph (entities, relationships, reports, clusters, sources, scans,
memory + forget events) lives in Cognee.

SQLite remains the fast operational store the API queries; Cognee becomes the
complete long-term memory mirror. Every call is non-fatal (graceful skip).

Usage (from backend/):
  python scripts/push_all_to_cognee.py            # push everything
  python scripts/push_all_to_cognee.py --limit 50 # quick test per table
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

import models  # noqa: E402
from config import settings  # noqa: E402
from database import SessionLocal  # noqa: E402
from services import cognee_service  # noqa: E402


def _notes(db, limit: int | None) -> list[tuple[str, str]]:
    """Build (node_set, text) notes for every row in the database."""
    cap = (lambda xs: xs[:limit] if limit else xs)
    notes: list[tuple[str, str]] = []

    ents = {e.id: e for e in db.scalars(select(models.Entity)).all()}
    clusters = {c.id: c for c in db.scalars(select(models.Cluster)).all()}
    sources = {s.id: s for s in db.scalars(select(models.Source)).all()}

    # Entities
    for e in cap(list(ents.values())):
        cl = clusters.get(e.cluster_id) if e.cluster_id else None
        chain = f" on {e.chain}" if e.chain else ""
        camp = f", part of the {cl.value} campaign" if cl else ""
        notes.append(("entity",
            f"{e.entity_type.title()} {e.value}{chain} is classified {e.risk_label} "
            f"(safety {e.risk_score}/100, status {e.status}){camp}."))

    # Relationships
    for r in cap(db.scalars(select(models.Relationship)).all()):
        a, b = ents.get(r.from_entity_id), ents.get(r.to_entity_id)
        if a and b:
            notes.append(("relationship",
                f"{a.value} {r.relationship_type.replace('_', ' ')} {b.value} "
                f"(confidence {r.confidence})."))

    # Reports
    for rp in cap(db.scalars(select(models.Report)).all()):
        e = ents.get(rp.entity_id)
        src = sources.get(rp.source_id) if rp.source_id else None
        if e:
            notes.append(("report",
                f"{e.value} was reported as a {rp.scam_type} scam (status {rp.status}) "
                f"via {src.name if src else rp.source_id or 'community'}: {rp.description}"))

    # Clusters
    for c in cap(list(clusters.values())):
        members = [e.value for e in ents.values() if e.cluster_id == c.id]
        notes.append(("cluster",
            f"Scam cluster '{c.value}' ({c.risk_label}) groups {len(members)} entities"
            + (f": {', '.join(members[:8])}." if members else ".")))

    # Sources
    for s in cap(list(sources.values())):
        notes.append(("source",
            f"Threat source '{s.name}' is a {s.source_type} with reliability {s.reliability_score}."))

    # Scan events
    for sc in cap(db.scalars(select(models.ScanEvent)).all()):
        notes.append(("scan_event",
            f"Scan of {sc.input_value} ({sc.input_type}) returned {sc.risk_label} "
            f"(safety {sc.risk_score}/100)."))

    # Memory events
    for m in cap(db.scalars(select(models.MemoryEvent)).all()):
        notes.append(("memory",
            f"Memory {m.event_type} event: {m.summary} — {m.reason}"))

    # Forget events
    for f in cap(db.scalars(select(models.ForgetEvent)).all()):
        e = ents.get(f.entity_id) if f.entity_id else None
        notes.append(("forget",
            f"Correction ({f.reason}): {e.value if e else f.entity_id} moved "
            f"{f.old_status} -> {f.new_status} by {f.performed_by}."))

    return notes


async def _remember_with_retry(text: str, node_set: str, retries: int) -> bool:
    """Push one note, retrying transient failures (e.g. cloud rate limits)."""
    for attempt in range(retries + 1):
        res = await cognee_service.remember_note(text, node_set=node_set)
        if res.get("ok") is True:
            return True
        if attempt < retries:
            await asyncio.sleep(2 ** attempt)  # 1s, 2s, 4s backoff
    return False


async def main(limit: int | None, only: set[str] | None, delay: float, retries: int) -> None:
    if not settings.cognee_enabled:
        print("Cognee not configured (set COGNEE_BASE_URL + COGNEE_API_KEY). Nothing to do.")
        return

    db = SessionLocal()
    try:
        notes = _notes(db, limit)
    finally:
        db.close()

    if only:
        notes = [(ns, t) for ns, t in notes if ns in only]

    total = len(notes)
    by_set: dict[str, list[int]] = {}  # node_set -> [ok, fail]
    print(f"Pushing {total} notes into Cognee (dataset: {settings.cognee_dataset}, "
          f"delay={delay}s, retries={retries}) …")

    ok = fail = 0
    for n, (node_set, text) in enumerate(notes, 1):
        good = await _remember_with_retry(text, node_set, retries)
        ok += good
        fail += not good
        tally = by_set.setdefault(node_set, [0, 0])
        tally[0 if good else 1] += 1
        if delay:
            await asyncio.sleep(delay)  # throttle to stay under cloud rate limits
        if n % 100 == 0:
            print(f"  … {n}/{total} ({ok} ok, {fail} failed)")

    print("\nPush complete — per node_set:")
    for node_set, (o, f) in sorted(by_set.items()):
        print(f"  {node_set:14} {o} ok, {f} failed")
    print(f"\n  TOTAL {ok}/{total} remembered, {fail} failed.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Mirror the whole AEGIS DB into Cognee.")
    ap.add_argument("--limit", type=int, default=None, help="Cap rows per table (quick test).")
    ap.add_argument("--only", type=str, default=None,
                    help="Comma-separated node_sets to push (e.g. report,cluster,source).")
    ap.add_argument("--delay", type=float, default=0.1,
                    help="Seconds to sleep between calls (throttle; default 0.1).")
    ap.add_argument("--retries", type=int, default=3,
                    help="Retry attempts per note with backoff (default 3).")
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(",")} if args.only else None
    asyncio.run(main(args.limit, only, args.delay, args.retries))
