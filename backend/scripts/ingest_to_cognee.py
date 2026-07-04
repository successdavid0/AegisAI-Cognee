"""Ingest the seeded threat graph into Cognee as natural-language memory.

Sends one `remember` note per entity and per relationship so Cognee builds the
knowledge graph. Non-fatal: skips gracefully if Cognee is not configured.

Usage (from backend/):  python scripts/ingest_to_cognee.py [--limit N]
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


async def main(limit: int | None) -> None:
    if not settings.cognee_enabled:
        print("Cognee not configured (set COGNEE_BASE_URL + COGNEE_API_KEY). Nothing to do.")
        return

    db = SessionLocal()
    ok = fail = 0
    try:
        entities = db.scalars(select(models.Entity)).all()
        for e in entities[: limit or len(entities)]:
            cluster = db.get(models.Cluster, e.cluster_id) if e.cluster_id else None
            text = (
                f"{e.entity_type.title()} {e.value} is risk {e.risk_label} "
                f"({e.risk_score}/100)"
                + (f", part of the {cluster.value} campaign." if cluster else ".")
            )
            res = await cognee_service.remember_note(text, node_set="entity")
            ok += res.get("ok") is True
            fail += res.get("ok") is not True

        rels = db.scalars(select(models.Relationship)).all()
        for r in rels[: limit or len(rels)]:
            a = db.get(models.Entity, r.from_entity_id)
            b = db.get(models.Entity, r.to_entity_id)
            if not a or not b:
                continue
            text = f"{a.value} {r.relationship_type.replace('_', ' ')} {b.value}."
            res = await cognee_service.remember_note(text, node_set="relationship")
            ok += res.get("ok") is True
            fail += res.get("ok") is not True
    finally:
        db.close()

    print(f"Cognee ingestion complete — {ok} remembered, {fail} failed.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=None, help="Cap items per type (for a quick test)")
    args = ap.parse_args()
    asyncio.run(main(args.limit))
