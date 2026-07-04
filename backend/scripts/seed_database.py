"""Seed the app database from data/*.json (idempotent).

Usage (from backend/):  python scripts/seed_database.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import func, select  # noqa: E402

import models  # noqa: E402
from database import SessionLocal, init_db  # noqa: E402
from services.ingestion_service import load_seed  # noqa: E402


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        load_seed(db)
        for model, label in [
            (models.Entity, "entities"), (models.Relationship, "relationships"),
            (models.Report, "reports"), (models.Cluster, "clusters"),
            (models.MemoryEvent, "memory_events"), (models.ForgetEvent, "forget_events"),
        ]:
            n = db.scalar(select(func.count()).select_from(model))
            print(f"  {label}: {n}")
    finally:
        db.close()
    print("Seed complete.")


if __name__ == "__main__":
    main()
