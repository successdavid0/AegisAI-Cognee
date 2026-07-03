// Typed API client for the AEGIS FastAPI backend.
// Each function maps to one endpoint (TRD §7). When the backend is unreachable
// (or NEXT_PUBLIC_MOCK_ONLY is set) it transparently falls back to seeded demo
// data, returning { data, live } so the UI can badge the source.
import type {
  ApiResult, EntityDetail, GraphData, Lifecycle, RecentScan, Report,
  ReportPayload, ScanResult, Stats,
} from "./types";
import * as mock from "./mock";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const MOCK_ONLY =
  (process.env.NEXT_PUBLIC_MOCK_ONLY ?? "true").toLowerCase() !== "false";

async function call<T>(
  path: string,
  fallback: () => T,
  init?: RequestInit,
): Promise<ApiResult<T>> {
  if (MOCK_ONLY) return { data: fallback(), live: false };
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { data: (await res.json()) as T, live: true };
  } catch {
    return { data: fallback(), live: false };
  }
}

export const api = {
  scan: (value: string) =>
    call<ScanResult>("/scan", () => mock.mockScan(value), {
      method: "POST",
      body: JSON.stringify({ value }),
    }),

  graph: (value: string, depth = 1) =>
    call<GraphData>(`/graph/${encodeURIComponent(value)}?depth=${depth}`, () =>
      mock.mockGraph(value, depth),
    ),

  lifecycle: (scanId: string) =>
    call<Lifecycle>(`/memory/lifecycle/${encodeURIComponent(scanId)}`, () =>
      mock.mockLifecycle(scanId),
    ),

  improve: () =>
    call("/memory/improve", () => mock.mockImproveAck(), { method: "POST", body: "{}" }),

  forget: (reason = "false_positive", reportId?: string) =>
    call("/memory/forget", () => mock.mockForgetAck(reason), {
      method: "POST",
      body: JSON.stringify({ reason, report_id: reportId ?? null }),
    }),

  submitReport: (payload: ReportPayload) =>
    call("/report", () => mock.mockReportAck(payload), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  adminReports: () => call<Report[]>("/admin/reports", () => mock.mockReports()),

  verifyReport: (id: string) =>
    call(`/admin/reports/${id}/verify`, () => ({ status: "ok", report_id: id, new_status: "verified" }), { method: "POST", body: "{}" }),

  rejectReport: (id: string) =>
    call(`/admin/reports/${id}/reject`, () => ({ status: "ok", report_id: id, new_status: "rejected" }), { method: "POST", body: "{}" }),

  markDuplicate: (id: string) =>
    call(`/admin/reports/${id}/duplicate`, () => ({ status: "ok", report_id: id, new_status: "duplicate" }), { method: "POST", body: "{}" }),

  markFalsePositive: (id: string) =>
    call(`/admin/reports/${id}/false-positive`, () => mock.mockForgetAck("false_positive"), { method: "POST", body: "{}" }),

  stats: () => call<Stats>("/stats", () => mock.mockStats()),

  recentScans: () => call<RecentScan[]>("/scans/recent", () => mock.mockRecentScans()),

  recentReports: () => call<Report[]>("/reports/recent", () => mock.mockReports().slice(0, 4)),

  entity: (value: string) =>
    call<EntityDetail>(`/entity/${encodeURIComponent(value)}`, () => mock.mockEntity(value)),
};
