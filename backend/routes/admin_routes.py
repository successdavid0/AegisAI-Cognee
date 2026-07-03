"""Admin review routes (Backend Spec §4, §8.4)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from services import cognee_service
from services.common import log_memory_event, memory_event_out, report_out
from services.report_service import set_status
from services.risk_engine import calculate_risk

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/reports", response_model=list[schemas.ReportOut])
def list_reports(db: Session = Depends(get_db)):
    rows = db.scalars(
        select(models.Report).order_by(models.Report.created_at.desc())
    ).all()
    return [report_out(db, r) for r in rows]


def _get_report(db: Session, report_id: str) -> models.Report:
    report = db.get(models.Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return report


@router.post("/reports/{report_id}/verify", response_model=schemas.AdminActionAck)
def verify(report_id: str, db: Session = Depends(get_db)):
    report = _get_report(db, report_id)
    set_status(db, report, "verified")
    entity = db.get(models.Entity, report.entity_id)
    if entity:
        v = calculate_risk(db, entity)
        entity.risk_score, entity.risk_label, entity.confidence = v["score"], v["label"], v["confidence"]
    log_memory_event(
        db, "remember", f"Verified report {report.id}",
        "Analyst confirmed the claim; it now counts toward risk.",
        entity_id=report.entity_id, report_id=report.id,
    )
    db.commit()
    return schemas.AdminActionAck(status="ok", report_id=report_id, new_status="verified")


@router.post("/reports/{report_id}/reject", response_model=schemas.AdminActionAck)
def reject(report_id: str, db: Session = Depends(get_db)):
    report = _get_report(db, report_id)
    set_status(db, report, "rejected")
    log_memory_event(
        db, "forget", f"Rejected report {report.id}",
        "Analyst rejected the claim; it will not affect risk.",
        entity_id=report.entity_id, report_id=report.id,
    )
    db.commit()
    return schemas.AdminActionAck(status="ok", report_id=report_id, new_status="rejected")


@router.post("/reports/{report_id}/duplicate", response_model=schemas.AdminActionAck)
def duplicate(report_id: str, db: Session = Depends(get_db)):
    report = _get_report(db, report_id)
    set_status(db, report, "duplicate")
    log_memory_event(
        db, "improve", f"Marked report {report.id} as duplicate",
        "Merged with an existing claim to keep memory clean.",
        entity_id=report.entity_id, report_id=report.id,
    )
    db.commit()
    return schemas.AdminActionAck(status="ok", report_id=report_id, new_status="duplicate")


@router.post("/reports/{report_id}/false-positive", response_model=schemas.OpAck)
async def false_positive(report_id: str, db: Session = Depends(get_db)):
    report = _get_report(db, report_id)
    entity = db.get(models.Entity, report.entity_id)
    set_status(db, report, "false_positive")

    result = await cognee_service.forget_memory(
        entity.value if entity else report_id, "false_positive"
    )
    note = "" if result.get("ok") else " (Cognee forget degraded; local correction applied)"

    if entity:
        v = calculate_risk(db, entity)
        entity.risk_score, entity.risk_label, entity.confidence = v["score"], v["label"], v["confidence"]

    ev = log_memory_event(
        db, "forget",
        f"Marked report {report.id} as a false positive (-50 correction)",
        f"Cognee correction applied; future risk scores drop{note}.",
        entity_id=report.entity_id, report_id=report.id,
    )
    db.commit()
    return schemas.OpAck(
        status="ok",
        summary=f"False positive recorded for {entity.value if entity else report_id}. "
                "Future risk scores will reflect this correction.",
        events=[memory_event_out(ev)],
    )
