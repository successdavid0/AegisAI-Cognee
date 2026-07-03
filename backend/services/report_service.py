"""Report lifecycle + correction logic (Backend Spec §5)."""
from __future__ import annotations

from sqlalchemy.orm import Session

import models
from services.common import find_or_create_entity, log_memory_event, new_id


def create_report(db: Session, payload) -> models.Report:
    entity = find_or_create_entity(db, payload.value, chain=payload.chain)
    report = models.Report(
        id=new_id("rpt"),
        entity_id=entity.id,
        scam_type=payload.scam_type,
        description=payload.description,
        evidence=payload.description,
        confidence=payload.confidence,
        status="pending",
        reporter=payload.reporter,
    )
    db.add(report)
    db.flush()
    log_memory_event(
        db,
        event_type="remember",
        summary=f"Remembered unverified report for {entity.value}",
        reason="User-submitted claim stored as pending; awaiting admin review.",
        entity_id=entity.id,
        report_id=report.id,
    )
    return report


def set_status(
    db: Session, report: models.Report, new_status: str, performed_by: str = "admin"
) -> models.ForgetEvent | None:
    old = report.status
    report.status = new_status
    forget: models.ForgetEvent | None = None
    if new_status in {"false_positive", "rejected"}:
        forget = models.ForgetEvent(
            entity_id=report.entity_id,
            report_id=report.id,
            reason=new_status,
            old_status=old,
            new_status=new_status,
            performed_by=performed_by,
        )
        db.add(forget)
    db.flush()
    return forget
