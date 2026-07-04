"""Dashboard stats + entity detail routes (Frontend Spec §4.1, §4.7)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import models
import schemas
from config import settings
from database import get_db
from services import cognee_service
from services.common import iso, memory_event_out, related_entities, report_out
from services.entity_extractor import detect_entity_type, normalize_entity

router = APIRouter(tags=["stats"])


def _count(db: Session, model, *where) -> int:
    stmt = select(func.count()).select_from(model)
    for w in where:
        stmt = stmt.where(w)
    return db.scalar(stmt) or 0


@router.get("/status", tags=["meta"])
async def system_status(db: Session = Depends(get_db)):
    """Full connectivity report for the System Status page: API, DB, Cognee."""
    # Database — a real query proves the connection works.
    try:
        database = {
            "connected": True,
            "engine": settings.database_url.split(":", 1)[0],
            "entities": _count(db, models.Entity),
            "reports": _count(db, models.Report),
            "clusters": _count(db, models.Cluster),
        }
    except Exception as exc:  # noqa: BLE001
        database = {"connected": False, "error": str(exc)}

    # Cognee — config + a live reachability ping.
    cognee = {**cognee_service.status(), **(await cognee_service.ping())}

    return {
        "api": {"ok": True, "version": "1.0.0", "env": settings.app_env},
        "database": database,
        "cognee": cognee,
        # Admin surface protected? (key set, or dev where it's intentionally open)
        "admin_auth_ready": bool(settings.admin_api_key) or not settings.is_production,
    }


@router.get("/stats", response_model=schemas.Stats)
def stats(db: Session = Depends(get_db)):
    return schemas.Stats(
        total_scans=_count(db, models.ScanEvent),
        total_reports=_count(db, models.Report),
        verified_scams=_count(db, models.Report, models.Report.status == "verified"),
        pending_reports=_count(db, models.Report, models.Report.status == "pending"),
        false_positives_corrected=_count(db, models.ForgetEvent, models.ForgetEvent.reason == "false_positive"),
        scam_clusters=_count(db, models.Cluster),
        memory_events=_count(db, models.MemoryEvent),
    )


@router.get("/entity/{value:path}", response_model=schemas.EntityDetail)
def entity_detail(value: str, db: Session = Depends(get_db)):
    etype = detect_entity_type(value)
    norm = normalize_entity(value, etype)
    entity = db.scalar(select(models.Entity).where(models.Entity.value == norm))
    if entity is None:
        entity = db.scalar(select(models.Entity).where(models.Entity.value == value))

    if entity is None:
        return schemas.EntityDetail(
            id="ent_unknown", type=etype, value=value, risk_label="Unknown",
            risk_score=None, confidence=None, status="unknown", first_seen=None,
            chain=None, reports=[], relationships=[], memory_events=[], scans=[],
        )

    reports = [report_out(db, r) for r in entity.reports]
    mem = db.scalars(
        select(models.MemoryEvent)
        .where(models.MemoryEvent.entity_id == entity.id)
        .order_by(models.MemoryEvent.created_at.desc())
    ).all()
    scans = db.scalars(
        select(models.ScanEvent)
        .where(models.ScanEvent.input_value == entity.value)
        .order_by(models.ScanEvent.created_at.desc())
    ).all()

    return schemas.EntityDetail(
        id=entity.id, type=entity.entity_type, value=entity.value,
        risk_label=entity.risk_label, risk_score=entity.risk_score,
        confidence=entity.confidence, status=entity.status,
        first_seen=iso(entity.first_seen), chain=entity.chain,
        reports=reports,
        relationships=related_entities(db, entity),
        memory_events=[memory_event_out(e) for e in mem],
        scans=[
            schemas.RecentScan(
                input_value=s.input_value, input_type=s.input_type,
                risk_score=s.risk_score, risk_label=s.risk_label, timestamp=iso(s.created_at),
            )
            for s in scans
        ],
    )
