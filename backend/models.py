"""SQLAlchemy models (Backend Spec §6, TRD §6).

String primary keys are used (e.g. "ent_domain_1", "rpt_1", "cluster_1") so IDs
are stable and match the seeded demo the frontend already renders.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    entity_type: Mapped[str] = mapped_column(String, index=True)
    value: Mapped[str] = mapped_column(String, unique=True, index=True)
    chain: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="unknown")
    risk_label: Mapped[str] = mapped_column(String, default="Unknown")
    risk_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    cluster_id: Mapped[str | None] = mapped_column(
        ForeignKey("clusters.id"), nullable=True
    )
    first_seen: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    reports: Mapped[list["Report"]] = relationship(back_populates="entity")
    cluster: Mapped["Cluster | None"] = relationship(back_populates="members")


class Cluster(Base):
    __tablename__ = "clusters"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String)  # human name
    risk_label: Mapped[str] = mapped_column(String, default="Critical")

    members: Mapped[list["Entity"]] = relationship(back_populates="cluster")


class Source(Base):
    __tablename__ = "sources"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    source_type: Mapped[str] = mapped_column(String)
    reliability_score: Mapped[float] = mapped_column(Float, default=0.5)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), index=True)
    source_id: Mapped[str | None] = mapped_column(String, nullable=True)
    scam_type: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)
    reporter: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    entity: Mapped["Entity"] = relationship(back_populates="reports")


class Relationship(Base):
    __tablename__ = "relationships"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    from_entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), index=True)
    to_entity_id: Mapped[str] = mapped_column(ForeignKey("entities.id"), index=True)
    relationship_type: Mapped[str] = mapped_column(String)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)


class ScanEvent(Base):
    __tablename__ = "scan_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    input_value: Mapped[str] = mapped_column(String, index=True)
    input_type: Mapped[str] = mapped_column(String)
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer)
    risk_label: Mapped[str] = mapped_column(String)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    explanation_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class MemoryEvent(Base):
    __tablename__ = "memory_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str] = mapped_column(String)  # recall|remember|improve|forget
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    scan_event_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    report_id: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str] = mapped_column(Text)
    reason: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ForgetEvent(Base):
    __tablename__ = "forget_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    report_id: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str] = mapped_column(String)
    old_status: Mapped[str | None] = mapped_column(String, nullable=True)
    new_status: Mapped[str | None] = mapped_column(String, nullable=True)
    performed_by: Mapped[str] = mapped_column(String, default="admin")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
