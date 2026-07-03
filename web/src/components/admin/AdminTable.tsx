"use client";
import { useState } from "react";
import { Check, X, Copy, ShieldOff } from "lucide-react";
import { Button, StatusPill, MonoValue, EmptyState } from "@/components/ui/primitives";
import { api } from "@/lib/api";
import { relativeTime, pct } from "@/lib/utils";
import type { Report, MemoryEvent } from "@/lib/types";

type Action = "verify" | "reject" | "duplicate" | "false_positive";

export function AdminTable({
  reports, onMemory,
}: {
  reports: Report[];
  onMemory?: (events: MemoryEvent[]) => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: Action, r: Report) {
    setBusy(`${action}:${r.id}`);
    const map: Record<Action, () => Promise<{ data: unknown }>> = {
      verify: () => api.verifyReport(r.id),
      reject: () => api.rejectReport(r.id),
      duplicate: () => api.markDuplicate(r.id),
      false_positive: () => api.markFalsePositive(r.id),
    };
    const { data } = await map[action]();
    const newStatus =
      action === "false_positive" ? "false_positive" : action === "verify" ? "verified" : action === "reject" ? "rejected" : "duplicate";
    setStatuses((s) => ({ ...s, [r.id]: newStatus }));

    const events =
      (data as { events?: MemoryEvent[] })?.events ??
      [
        {
          event_type: action === "false_positive" || action === "reject" ? "forget" : "improve",
          summary: `${action.replace(/_/g, " ")} applied to ${r.entity_value}`,
          reason: "Admin review action.",
          timestamp: new Date().toISOString(),
        } as MemoryEvent,
      ];
    onMemory?.(events);
    setBusy(null);
  }

  if (reports.length === 0) {
    return <EmptyState title="No reports to review." icon={Check} />;
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => {
        const status = statuses[r.id] ?? r.status;
        return (
          <div key={r.id} className="panel p-4">
            <div className="flex flex-wrap items-center gap-2">
              <MonoValue
                value={r.entity_value}
                href={`/entity/${encodeURIComponent(r.entity_value)}`}
              />
              <StatusPill status={status} />
              <span className="ml-auto text-[11px] text-muted">
                {relativeTime(r.created_at)}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink">
              <span className="font-medium text-brand-2">{r.scam_type}</span> — {r.description}
            </p>
            <p className="mt-1 text-xs text-muted">
              Reporter confidence: {pct(r.confidence)}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("verify", r)}>
                <Check className="h-3.5 w-3.5 text-low" /> Verify
              </Button>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("reject", r)}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run("duplicate", r)}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              <Button size="sm" variant="danger" disabled={!!busy} onClick={() => run("false_positive", r)}>
                <ShieldOff className="h-3.5 w-3.5" /> False positive
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
