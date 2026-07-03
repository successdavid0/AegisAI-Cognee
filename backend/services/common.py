"""Shared helpers: id generation, entity upsert, memory-event logging, and
serialization to the frontend contract shapes.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

import models
from services.entity_extractor import detect_entity_type, normalize_entity


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


def find_or_create_entity(
    db: Session, value: str, entity_type: str | None = None, chain: str | None = None
) -> models.Entity:
    etype = entity_type or detect_entity_type(value)
    norm = normalize_entity(value, etype)
    entity = db.scalar(select(models.Entity).where(models.Entity.value == norm))
    if entity:
        entity.last_seen = datetime.now(timezone.utc)
        return entity
    entity = models.Entity(
        id=new_id("ent"),
        entity_type=etype,
        value=norm,
        chain=chain,
        status="unknown",
        risk_label="Unknown",
        risk_score=None,
        confidence=None,
    )
    db.add(entity)
    db.flush()
    return entity


def log_memory_event(
    db: Session,
    event_type: str,
    summary: str,
    reason: str,
    entity_id: str | None = None,
    scan_event_id: str | None = None,
    report_id: str | None = None,
) -> models.MemoryEvent:
    ev = models.MemoryEvent(
        id=new_id("mem"),
        event_type=event_type,
        summary=summary,
        reason=reason,
        entity_id=entity_id,
        scan_event_id=scan_event_id,
        report_id=report_id,
    )
    db.add(ev)
    db.flush()
    return ev


def memory_event_out(ev: models.MemoryEvent) -> dict:
    return {
        "id": ev.id,
        "event_type": ev.event_type,
        "summary": ev.summary,
        "reason": ev.reason,
        "timestamp": iso(ev.created_at),
    }


def report_out(db: Session, r: models.Report) -> dict:
    entity = db.get(models.Entity, r.entity_id)
    return {
        "id": r.id,
        "entity_value": entity.value if entity else "",
        "entity_type": entity.entity_type if entity else "unknown",
        "scam_type": r.scam_type,
        "description": r.description,
        "status": r.status,
        "confidence": r.confidence,
        "created_at": iso(r.created_at),
    }


def related_entities(db: Session, entity: models.Entity) -> list[dict]:
    from sqlalchemy import or_

    rels = db.scalars(
        select(models.Relationship).where(
            or_(
                models.Relationship.from_entity_id == entity.id,
                models.Relationship.to_entity_id == entity.id,
            )
        )
    ).all()
    out: list[dict] = []
    seen: set[str] = set()
    for r in rels:
        other_id = r.to_entity_id if r.from_entity_id == entity.id else r.from_entity_id
        if other_id in seen:
            continue
        seen.add(other_id)
        other = db.get(models.Entity, other_id)
        if not other:
            continue
        out.append({
            "id": other.id,
            "type": other.entity_type,
            "value": other.value,
            "risk_label": other.risk_label,
            "relationship": r.relationship_type,
            "confidence": r.confidence,
        })
    return out
