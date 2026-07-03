"""Report routes (Backend Spec §4, §8.2)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from services import cognee_service
from services.common import report_out
from services.report_service import create_report

router = APIRouter(tags=["report"])


@router.post("/report", response_model=schemas.ReportAck)
async def submit_report(req: schemas.ReportRequest, db: Session = Depends(get_db)):
    if not req.value.strip() or not req.description.strip():
        raise HTTPException(status_code=422, detail="Entity and description are required.")

    report = create_report(db, req)
    # Remember the unverified claim (non-fatal).
    await cognee_service.remember_memory({
        "type": "report", "value": req.value, "scam_type": req.scam_type,
        "status": "pending",
    })
    db.commit()

    entity = db.get(models.Entity, report.entity_id)
    return schemas.ReportAck(
        report_id=report.id,
        status="pending",
        message="Report saved as an unverified claim and remembered by Cognee.",
        entity_value=entity.value if entity else req.value,
    )


@router.get("/reports/recent", response_model=list[schemas.ReportOut])
def recent_reports(db: Session = Depends(get_db), limit: int = 4):
    rows = db.scalars(
        select(models.Report).order_by(models.Report.created_at.desc()).limit(limit)
    ).all()
    return [report_out(db, r) for r in rows]
