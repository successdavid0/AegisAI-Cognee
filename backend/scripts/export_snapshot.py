"""Export the local threat-intel DB to data/db_snapshot.json.

Production runs on ephemeral SQLite (free tier) that resets on every deploy,
so the snapshot is committed to the repo and reloaded at startup by
ingestion_service.load_snapshot(). Run this after enriching the local DB
(e.g. a CryptoScamDB import or a batch of verified reports), commit the JSON,
and push — the next production boot carries the full dataset.

Usage (from backend/):
  python scripts/export_snapshot.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

import models  # noqa: E402
from database import SessionLocal, init_db  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "db_snapshot.json"


def iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        entities = db.scalars(select(models.Entity)).all()
        id_to_value = {e.id: e.value for e in entities}

        snap = {
            "entities": [
                {
                    "entity_type": e.entity_type,
                    "value": e.value,
                    "chain": e.chain,
                    "status": e.status,
                    "risk_label": e.risk_label,
                    "risk_score": e.risk_score,
                    "confidence": e.confidence,
                    "cluster_id": e.cluster_id,
                    "first_seen": iso(e.first_seen),
                    "last_seen": iso(e.last_seen),
                }
                for e in entities
            ],
            "reports": [
                {
                    "entity_value": id_to_value[r.entity_id],
                    "source_id": r.source_id,
                    "scam_type": r.scam_type,
                    "description": r.description,
                    "evidence": r.evidence,
                    "confidence": r.confidence,
                    "status": r.status,
                    "reporter": r.reporter,
                    "created_at": iso(r.created_at),
                }
                for r in db.scalars(select(models.Report)).all()
                if r.entity_id in id_to_value
            ],
            "relationships": [
                {
                    "from_value": id_to_value[rel.from_entity_id],
                    "to_value": id_to_value[rel.to_entity_id],
                    "relationship_type": rel.relationship_type,
                    "confidence": rel.confidence,
                    "evidence": rel.evidence,
                }
                for rel in db.scalars(select(models.Relationship)).all()
                if rel.from_entity_id in id_to_value and rel.to_entity_id in id_to_value
            ],
        }
    finally:
        db.close()

    OUT.write_text(json.dumps(snap, indent=1))
    print(
        f"Exported {len(snap['entities'])} entities, {len(snap['reports'])} reports, "
        f"{len(snap['relationships'])} relationships -> {OUT}"
        f" ({OUT.stat().st_size / 1024:.0f} KB)"
    )


if __name__ == "__main__":
    main()
