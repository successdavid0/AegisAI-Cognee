"use client";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Sparkles, Eraser, AlertTriangle, KeyRound } from "lucide-react";
import { api, adminKey } from "@/lib/api";
import { store } from "@/lib/store";
import { useData } from "@/lib/useData";
import { PageHeader, Panel, Button, DataBadge, Skeleton } from "@/components/ui/primitives";
import { AdminTable } from "@/components/admin/AdminTable";
import type { MemoryEvent, ReportStatus } from "@/lib/types";

const FILTERS: (ReportStatus | "all")[] = [
  "all", "pending", "verified", "rejected", "false_positive", "duplicate",
];

export default function AdminPage() {
  const reports = useData(() => api.adminReports(), []);
  const [filter, setFilter] = useState<ReportStatus | "all">("pending");
  const [key, setKey] = useState("");
  useEffect(() => setKey(adminKey.get()), []);

  const filtered = useMemo(
    () =>
      (reports.data ?? []).filter((r) => filter === "all" || r.status === filter),
    [reports.data, filter],
  );

  function onMemory(events: MemoryEvent[]) {
    store.logMemory(events);
  }

  async function bulk(kind: "improve" | "forget") {
    const { data } = kind === "improve" ? await api.improve() : await api.forget("false_positive");
    store.logMemory((data as { events: MemoryEvent[] }).events);
  }

  return (
    <div className="animate-rise">
      <PageHeader
        icon={ShieldCheck}
        title="Admin Review"
        subtitle="Verify claims, correct false positives, and run memory operations"
        actions={<DataBadge live={reports.live} />}
      />

      <div className="panel mb-5 flex gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-suspicious" />
        <p className="text-sm text-ink-soft">
          Admin actions are logged. Reports are unverified claims until an analyst verifies
          them. Marking a <span className="text-ink">false positive</span> triggers a Cognee
          forget/correction that lowers future risk scores.
        </p>
      </div>

      {/* Admin key — required by the backend in production; blank works in local dev. */}
      <div className="panel mb-5 flex flex-wrap items-center gap-3 p-4">
        <KeyRound className="h-4 w-4 shrink-0 text-brand-2" />
        <label className="text-sm text-ink-soft">Admin key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={() => adminKey.set(key)}
          placeholder="X-Admin-Key (sent with admin actions)"
          className="mono focus-ring min-w-[240px] flex-1 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-ink placeholder:font-sans placeholder:text-muted"
        />
        <Button variant="outline" size="sm" onClick={() => adminKey.set(key)}>
          Save key
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f === "all"
              ? reports.data?.length ?? 0
              : reports.data?.filter((r) => r.status === f).length ?? 0;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`focus-ring rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "border-brand/50 bg-brand/15 text-ink"
                  : "border-line text-muted hover:bg-white/[0.04]"
              }`}
            >
              {f.replace(/_/g, " ")} <span className="text-muted">· {count}</span>
            </button>
          );
        })}
      </div>

      {reports.loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <AdminTable reports={filtered} onMemory={onMemory} />
      )}

      <Panel className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-ink">Bulk memory operations</h3>
        <div className="flex flex-wrap gap-2.5">
          <Button variant="outline" onClick={() => bulk("improve")}>
            <Sparkles className="h-4 w-4 text-low" /> Run improve (link &amp; merge)
          </Button>
          <Button variant="danger" onClick={() => bulk("forget")}>
            <Eraser className="h-4 w-4" /> Forget stale false positives
          </Button>
        </div>
      </Panel>
    </div>
  );
}
