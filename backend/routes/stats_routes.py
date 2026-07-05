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

    # Cognee — config + a live reachability ping + record count in the dataset.
    cognee = {
        **cognee_service.status(),
        **(await cognee_service.ping()),
        **(await cognee_service.dataset_info()),
    }

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


_ENTITY_SORTS = {"risk", "reports", "recent", "value"}


@router.get("/entities", response_model=schemas.EntityListPage)
def list_entities(
    q: str = "",
    type: str = "",
    risk: str = "",
    status: str = "",
    sort: str = "risk",
    order: str = "",
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
):
    """Browse every entity in the database with search/filter/sort/pagination.

    Default sort is most threatening first (risk_score is a SAFETY score, so
    ascending = most dangerous at the top).
    """
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    if sort not in _ENTITY_SORTS:
        sort = "risk"

    report_count = (
        select(func.count(models.Report.id))
        .where(models.Report.entity_id == models.Entity.id)
        .correlate(models.Entity)
        .scalar_subquery()
    )
    # Representative scam type: the entity's most recent report.
    scam_type = (
        select(models.Report.scam_type)
        .where(models.Report.entity_id == models.Entity.id)
        .order_by(models.Report.created_at.desc())
        .limit(1)
        .correlate(models.Entity)
        .scalar_subquery()
    )

    filters = []
    if q.strip():
        filters.append(models.Entity.value.ilike(f"%{q.strip()}%"))
    if type:
        filters.append(models.Entity.entity_type == type)
    if risk:
        filters.append(models.Entity.risk_label == risk)
    if status:
        filters.append(models.Entity.status == status)

    total = db.scalar(
        select(func.count()).select_from(models.Entity).where(*filters)
    ) or 0

    stmt = select(models.Entity, report_count.label("rc"), scam_type.label("st")).where(*filters)
    if sort == "risk":
        col = models.Entity.risk_score.desc() if order == "desc" else models.Entity.risk_score.asc()
        stmt = stmt.order_by(col.nullslast(), models.Entity.value)
    elif sort == "reports":
        stmt = stmt.order_by(report_count.asc() if order == "asc" else report_count.desc())
    elif sort == "recent":
        stmt = stmt.order_by(
            models.Entity.last_seen.asc() if order == "asc" else models.Entity.last_seen.desc()
        )
    else:  # value
        stmt = stmt.order_by(
            models.Entity.value.desc() if order == "desc" else models.Entity.value.asc()
        )
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()

    return schemas.EntityListPage(
        items=[
            schemas.EntityListItem(
                id=e.id, type=e.entity_type, value=e.value, chain=e.chain,
                status=e.status, risk_label=e.risk_label, risk_score=e.risk_score,
                confidence=e.confidence, report_count=rc or 0, scam_type=st,
                first_seen=iso(e.first_seen), last_seen=iso(e.last_seen),
            )
            for e, rc, st in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
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
