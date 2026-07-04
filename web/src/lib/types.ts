// Shared types mirroring the FastAPI backend contract (TRD §7).
// The frontend consumes these shapes only — no scoring logic lives here.

export type EntityType =
  | "wallet"
  | "domain"
  | "url"
  | "contract"
  | "handle"
  | "message"
  | "tx"
  | "cluster"
  | "source"
  | "unknown";

export type RiskLabel =
  | "Critical"
  | "High Risk"
  | "Suspicious"
  | "Low Risk"
  | "Unknown";

export type MemoryEventType = "recall" | "remember" | "improve" | "forget";

export type ReportStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "false_positive"
  | "duplicate";

export interface Reason {
  text: string;
  weight: number;
}

export interface Evidence {
  description: string;
  source: string;
  source_type: string;
  reliability: number;
}

export interface RelatedEntity {
  id: string;
  type: EntityType;
  value: string;
  risk_label: RiskLabel;
  relationship?: string;
  confidence?: number;
}

export interface ScanResult {
  scan_id: string;
  input_value: string;
  input_type: EntityType;
  entity_id: string;
  risk_score: number;
  risk_label: RiskLabel;
  confidence: number;
  reasons: Reason[];
  evidence: Evidence[];
  related_entities: RelatedEntity[];
  lifecycle_preview: MemoryEvent[];
}

export interface GraphNode {
  id: string;
  value: string;
  type: EntityType;
  risk_label: RiskLabel;
  risk_score?: number | null;
}

export interface GraphEdge {
  from: string;
  to: string;
  relationship_type: string;
  confidence: number;
}

export interface GraphData {
  root: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface MemoryEvent {
  id?: string;
  event_type: MemoryEventType;
  summary: string;
  reason: string;
  timestamp?: string;
}

export interface Lifecycle {
  scan_id: string;
  events: MemoryEvent[];
}

export interface Report {
  id: string;
  entity_value: string;
  entity_type: EntityType;
  scam_type: string;
  description: string;
  status: ReportStatus;
  confidence: number;
  created_at: string;
}

export interface Stats {
  total_scans: number;
  total_reports: number;
  verified_scams: number;
  pending_reports: number;
  false_positives_corrected: number;
  scam_clusters: number;
  memory_events: number;
}

export interface RecentScan {
  input_value: string;
  input_type: EntityType;
  risk_score: number;
  risk_label: RiskLabel;
  timestamp: string;
}

export interface EntityDetail extends GraphNode {
  confidence?: number | null;
  status?: string;
  first_seen?: string | null;
  chain?: string | null;
  reports: Report[];
  relationships: RelatedEntity[];
  memory_events: MemoryEvent[];
  scans: RecentScan[];
}

export interface ReportPayload {
  value: string;
  scam_type: string;
  confidence: number;
  description: string;
  reporter?: string | null;
}

// System Status page — connectivity report from GET /status.
export interface SystemStatus {
  api: { ok: boolean; version: string; env: string };
  database: {
    connected: boolean;
    engine?: string;
    entities?: number;
    reports?: number;
    clusters?: number;
    error?: string;
  };
  cognee: {
    enabled: boolean;
    mode: string;
    dataset: string;
    base_url: string | null;
    reachable: boolean;
    latency_ms?: number;
    status_code?: number;
    records?: number | null;
    processing_status?: string | null;
    error?: string;
  };
  admin_auth_ready: boolean;
}

// Wraps a response with provenance so the UI can show LIVE vs DEMO data.
export interface ApiResult<T> {
  data: T;
  live: boolean;
}
