"""Scan routes (Backend Spec §4, §8.1)."""
from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from services import cognee_service
from services.common import (
    find_or_create_entity, iso, log_memory_event, memory_event_out,
    new_id, related_entities,
)
from services.entity_extractor import detect_entity_type
from services.risk_engine import calculate_risk

router = APIRouter(tags=["scan"])


@router.post("/scan", response_model=schemas.ScanResult)
async def scan(req: schemas.ScanRequest, db: Session = Depends(get_db)):
    value = (req.value or "").strip()
    if not value:
        raise HTTPException(status_code=422, detail="Scan input must not be empty.")

    etype = detect_entity_type(value)
    entity = find_or_create_entity(db, value)

    # Cognee recall (non-fatal). The persisted memory_event is the UI's record.
    recall = await cognee_service.recall_memory(value)
    related = related_entities(db, entity)

    verdict = calculate_risk(db, entity)

    # Persist the computed verdict onto the entity so graph/dashboard stay live.
    entity.risk_score = verdict["score"]
    entity.risk_label = verdict["label"]
    entity.confidence = verdict["confidence"]

    scan_id = new_id("scan")
    scan_event = models.ScanEvent(
        id=scan_id, input_value=value, input_type=etype, entity_id=entity.id,
        risk_score=verdict["score"], risk_label=verdict["label"],
        confidence=verdict["confidence"],
        explanation_json=json.dumps({"reasons": verdict["reasons"]}),
    )
    db.add(scan_event)

    recalled_n = len(related)
    recall_note = "" if recall.get("ok") else " (recall degraded)"
    ev_recall = log_memory_event(
        db, "recall",
        f"Recalled {recalled_n} related memories for {value}",
        f"Scan queried the {cognee_service.DATASET} dataset{recall_note}.",
        entity_id=entity.id, scan_event_id=scan_id,
    )
    # Remember this scan event.
    remember = await cognee_service.remember_memory({
        "type": "scan_event", "value": value, "risk_label": verdict["label"],
        "risk_score": verdict["score"],
    })
    remember_note = "" if remember.get("ok") else " (remember degraded)"
    ev_remember = log_memory_event(
        db, "remember",
        "Remembered this scan event and its verdict",
        f"Scan events are stored so future recalls see this interaction{remember_note}.",
        entity_id=entity.id, scan_event_id=scan_id,
    )
    db.commit()

    return schemas.ScanResult(
        scan_id=scan_id,
        input_value=value,
        input_type=etype,
        entity_id=entity.id,
        risk_score=verdict["score"],
        risk_label=verdict["label"],
        confidence=verdict["confidence"],
        reasons=verdict["reasons"],
        evidence=verdict["evidence"],
        related_entities=related,
        lifecycle_preview=[memory_event_out(ev_recall), memory_event_out(ev_remember)],
    )


@router.get("/scans/recent", response_model=list[schemas.RecentScan])
def recent_scans(db: Session = Depends(get_db), limit: int = 8):
    rows = db.scalars(
        select(models.ScanEvent).order_by(models.ScanEvent.created_at.desc()).limit(limit)
    ).all()
    return [
        schemas.RecentScan(
            input_value=s.input_value, input_type=s.input_type,
            risk_score=s.risk_score, risk_label=s.risk_label, timestamp=iso(s.created_at),
        )
        for s in rows
    ]
