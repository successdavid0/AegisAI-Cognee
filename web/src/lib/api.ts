// Typed API client for the AEGIS FastAPI backend.
// Each function maps to one endpoint (TRD §7). When the backend is unreachable
// (or NEXT_PUBLIC_MOCK_ONLY is set) it transparently falls back to seeded demo
// data, returning { data, live } so the UI can badge the source.
import type {
  ApiResult, EntityDetail, EntityListPage, EntityListQuery, GraphData,
  Lifecycle, RecentScan, Report, ReportPayload, ScanResult, Stats, SystemStatus,
} from "./types";
import * as mock from "./mock";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
// Live by default: the app always tries the real backend and only falls back to
// seeded demo data if a request fails (or if mock mode is explicitly forced).
// Set NEXT_PUBLIC_MOCK_ONLY=true to force offline/demo mode.
const MOCK_ONLY =
  (process.env.NEXT_PUBLIC_MOCK_ONLY ?? "false").toLowerCase() === "true";

// Admin key for state-mutating admin/memory routes. Kept in sessionStorage and
// entered at runtime on the Admin page — never baked into the JS bundle, so it
// is not shipped to every client the way a NEXT_PUBLIC_ var would be.
const ADMIN_KEY_STORAGE = "aegis_admin_key";
export const adminKey = {
  get: (): string =>
    typeof window === "undefined" ? "" : sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? "",
  set: (v: string) => {
    if (typeof window !== "undefined") sessionStorage.setItem(ADMIN_KEY_STORAGE, v.trim());
  },
};
function adminHeaders(): Record<string, string> {
  const k = adminKey.get();
  return k ? { "X-Admin-Key": k } : {};
}

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
      // Generous timeout so a cold-starting free-tier backend (Render spins down
      // after ~15 min idle and takes 30–60s to wake) still connects live instead
      // of falling back to demo data.
      signal: AbortSignal.timeout(45000),
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
    call("/memory/improve", () => mock.mockImproveAck(), {
      method: "POST", body: "{}", headers: adminHeaders(),
    }),

  forget: (reason = "false_positive", reportId?: string) =>
    call("/memory/forget", () => mock.mockForgetAck(reason), {
      method: "POST",
      body: JSON.stringify({ reason, report_id: reportId ?? null }),
      headers: adminHeaders(),
    }),

  submitReport: (payload: ReportPayload) =>
    call("/report", () => mock.mockReportAck(payload), {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  adminReports: () => call<Report[]>("/admin/reports", () => mock.mockReports()),

  verifyReport: (id: string) =>
    call(`/admin/reports/${id}/verify`, () => ({ status: "ok", report_id: id, new_status: "verified" }), { method: "POST", body: "{}", headers: adminHeaders() }),

  rejectReport: (id: string) =>
    call(`/admin/reports/${id}/reject`, () => ({ status: "ok", report_id: id, new_status: "rejected" }), { method: "POST", body: "{}", headers: adminHeaders() }),

  markDuplicate: (id: string) =>
    call(`/admin/reports/${id}/duplicate`, () => ({ status: "ok", report_id: id, new_status: "duplicate" }), { method: "POST", body: "{}", headers: adminHeaders() }),

  markFalsePositive: (id: string) =>
    call(`/admin/reports/${id}/false-positive`, () => mock.mockForgetAck("false_positive"), { method: "POST", body: "{}", headers: adminHeaders() }),

  stats: () => call<Stats>("/stats", () => mock.mockStats()),

  status: () => call<SystemStatus>("/status", () => mock.mockStatus()),

  recentScans: () => call<RecentScan[]>("/scans/recent", () => mock.mockRecentScans()),

  recentReports: () => call<Report[]>("/reports/recent", () => mock.mockReports().slice(0, 4)),

  entity: (value: string) =>
    call<EntityDetail>(`/entity/${encodeURIComponent(value)}`, () => mock.mockEntity(value)),

  entityList: (query: EntityListQuery = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return call<EntityListPage>(`/entities${qs ? `?${qs}` : ""}`, () =>
      mock.mockEntityList(query),
    );
  },
};
