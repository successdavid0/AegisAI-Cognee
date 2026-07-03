"""Pydantic response/request schemas.

These match the frontend contract in web/src/lib/types.ts field-for-field, so
the Next.js app consumes this backend unchanged (set NEXT_PUBLIC_MOCK_ONLY=false).
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


# ---------- Requests ----------
class ScanRequest(BaseModel):
    value: str


class ReportRequest(BaseModel):
    value: str
    scam_type: str
    confidence: float = 0.5
    description: str
    reporter: str | None = None
    chain: str | None = None


class ForgetRequest(BaseModel):
    reason: str = "false_positive"
    report_id: str | None = None


# ---------- Shared pieces ----------
class Reason(BaseModel):
    text: str
    weight: int


class Evidence(BaseModel):
    description: str
    source: str
    source_type: str
    reliability: float


class RelatedEntity(BaseModel):
    id: str
    type: str
    value: str
    risk_label: str
    relationship: str | None = None
    confidence: float | None = None


class MemoryEventOut(BaseModel):
    id: str | None = None
    event_type: str
    summary: str
    reason: str
    timestamp: str | None = None


# ---------- Scan ----------
class ScanResult(BaseModel):
    scan_id: str
    input_value: str
    input_type: str
    entity_id: str
    risk_score: int
    risk_label: str
    confidence: float
    reasons: list[Reason]
    evidence: list[Evidence]
    related_entities: list[RelatedEntity]
    lifecycle_preview: list[MemoryEventOut]


# ---------- Graph ----------
class GraphNode(BaseModel):
    id: str
    value: str
    type: str
    risk_label: str
    risk_score: int | None = None


class GraphEdge(BaseModel):
    # `from` is reserved in Python; expose it via alias on the wire.
    model_config = ConfigDict(populate_by_name=True)
    from_: str = Field(alias="from")
    to: str
    relationship_type: str
    confidence: float


class GraphData(BaseModel):
    root: str
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ---------- Memory ----------
class Lifecycle(BaseModel):
    scan_id: str
    events: list[MemoryEventOut]


class OpAck(BaseModel):
    status: str
    summary: str
    events: list[MemoryEventOut]


# ---------- Reports ----------
class ReportOut(BaseModel):
    id: str
    entity_value: str
    entity_type: str
    scam_type: str
    description: str
    status: str
    confidence: float
    created_at: str


class ReportAck(BaseModel):
    report_id: str
    status: str
    message: str
    entity_value: str


class AdminActionAck(BaseModel):
    status: str
    report_id: str
    new_status: str


# ---------- Dashboard / entity ----------
class Stats(BaseModel):
    total_scans: int
    total_reports: int
    verified_scams: int
    pending_reports: int
    false_positives_corrected: int
    scam_clusters: int
    memory_events: int


class RecentScan(BaseModel):
    input_value: str
    input_type: str
    risk_score: int
    risk_label: str
    timestamp: str


class EntityDetail(BaseModel):
    id: str
    type: str
    value: str
    risk_label: str
    risk_score: int | None = None
    confidence: float | None = None
    status: str | None = None
    first_seen: str | None = None
    chain: str | None = None
    reports: list[ReportOut]
    relationships: list[RelatedEntity]
    memory_events: list[MemoryEventOut]
    scans: list[RecentScan]
