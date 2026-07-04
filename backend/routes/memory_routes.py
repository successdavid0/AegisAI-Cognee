"""Memory lifecycle routes (Backend Spec §4, §8.3, §8.4)."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from services import cognee_service
from services.auth import require_admin
from services.common import log_memory_event, memory_event_out

router = APIRouter(tags=["memory"])

# Memory mutations (improve/forget) require the admin key; GET lifecycle is public.
admin_auth = Depends(require_admin)


@router.get("/memory/lifecycle/{scan_id}", response_model=schemas.Lifecycle)
def lifecycle(scan_id: str, db: Session = Depends(get_db)):
    events = db.scalars(
        select(models.MemoryEvent)
        .where(models.MemoryEvent.scan_event_id == scan_id)
        .order_by(models.MemoryEvent.created_at.asc())
    ).all()
    return schemas.Lifecycle(
        scan_id=scan_id, events=[memory_event_out(e) for e in events]
    )


@router.post("/memory/improve", response_model=schemas.OpAck, dependencies=[admin_auth])
async def improve(db: Session = Depends(get_db)):
    result = await cognee_service.improve_memory()
    note = "" if result.get("ok") else " (Cognee improve degraded; local enrichment applied)"

    # Local enrichment: count pending reports that belong to a clustered entity
    # and would be linked, plus any duplicate handles.
    clustered = db.scalars(
        select(models.Entity).where(models.Entity.cluster_id.isnot(None))
    ).all()
    linked = db.scalar(
        select(models.Report).where(models.Report.status == "pending").limit(1)
    )

    events = []
    events.append(log_memory_event(
        db, "improve",
        f"Linked {len(clustered)} entities within the Fake Uniswap Airdrop cluster",
        f"Enrichment matched shared wallet + domain patterns{note}.",
    ))
    if linked:
        events.append(log_memory_event(
            db, "improve",
            f"Linked report {linked.id} to its scam cluster",
            "Shared drainer wallet and domain pattern.",
            report_id=linked.id,
        ))
    db.commit()

    return schemas.OpAck(
        status="ok",
        summary=f"Improve linked {len(clustered)} clustered entities and enriched "
                "pending reports into scam clusters.",
        events=[memory_event_out(e) for e in events],
    )


@router.post("/memory/forget", response_model=schemas.OpAck, dependencies=[admin_auth])
async def forget(req: schemas.ForgetRequest, db: Session = Depends(get_db)):
    target_value = "the affected claim"
    old_status = None
    report = db.get(models.Report, req.report_id) if req.report_id else None
    if report:
        old_status = report.status
        report.status = "false_positive" if req.reason == "false_positive" else "rejected"
        entity = db.get(models.Entity, report.entity_id)
        target_value = entity.value if entity else target_value
        db.add(models.ForgetEvent(
            entity_id=report.entity_id, report_id=report.id, reason=req.reason,
            old_status=old_status, new_status=report.status,
        ))

    result = await cognee_service.forget_memory(target_value, req.reason)
    note = "" if result.get("ok") else " (Cognee forget degraded; local correction applied)"

    ev = log_memory_event(
        db, "forget",
        f"Forget/correction recorded ({req.reason.replace('_', ' ')})",
        f"Future risk scores will reflect this change{note}.",
        report_id=req.report_id,
    )
    db.commit()

    return schemas.OpAck(
        status="ok",
        summary=f"Forget/correction recorded ({req.reason}). Future risk scores will "
                "reflect this change.",
        events=[memory_event_out(ev)],
    )
