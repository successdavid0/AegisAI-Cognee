"use client";
import { useState } from "react";
import { BrainCircuit, Sparkles, Eraser, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { store, useStore } from "@/lib/store";
import { PageHeader, Panel, Button, EmptyState } from "@/components/ui/primitives";
import { MemoryTimeline } from "@/components/memory/MemoryTimeline";
import type { Lifecycle, MemoryEvent } from "@/lib/types";

const CYCLE = [
  { k: "recall", c: "#5b8def", t: "Recall", d: "Finds connected threats already in memory." },
  { k: "remember", c: "#9b7bff", t: "Remember", d: "Stores new scans and claims as evidence." },
  { k: "improve", c: "#2ee6a6", t: "Improve", d: "Links memories into scam clusters." },
  { k: "forget", c: "#ff4d5e", t: "Forget", d: "Downgrades false or stale claims." },
];

export default function MemoryPage() {
  const latestScan = useStore((s) => s.latestScan);
  const memoryLog = useStore((s) => s.memoryLog);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [scanId, setScanId] = useState(latestScan?.scan_id ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<MemoryEvent[] | null>(null);
  const [forgetReason, setForgetReason] = useState("false_positive");

  async function loadLifecycle() {
    if (!scanId.trim()) return;
    const { data } = await api.lifecycle(scanId.trim());
    setLifecycle(data);
    store.logMemory(data.events);
  }

  async function runImprove() {
    setBusy("improve");
    const { data } = await api.improve();
    const events = (data as { events: MemoryEvent[] }).events;
    setActionResult(events);
    store.logMemory(events);
    setBusy(null);
  }

  async function runForget() {
    setBusy("forget");
    const { data } = await api.forget(forgetReason);
    const events = (data as { events: MemoryEvent[] }).events;
    setActionResult(events);
    store.logMemory(events);
    setBusy(null);
  }

  return (
    <div className="animate-rise">
      <PageHeader
        icon={BrainCircuit}
        title="Memory Lifecycle"
        subtitle="See Cognee recall · remember · improve · forget in action"
      />

      {/* Cycle explainer */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {CYCLE.map((s) => (
          <div key={s.k} className="panel panel-hover p-4" style={{ borderColor: `${s.c}22` }}>
            <div
              className="mb-2 h-1.5 w-8 rounded-full"
              style={{ background: s.c, boxShadow: `0 0 12px ${s.c}` }}
            />
            <div className="text-sm font-semibold" style={{ color: s.c }}>
              {s.t}
            </div>
            <p className="mt-1 text-xs text-muted">{s.d}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Lifecycle for a scan */}
        <Panel>
          <h3 className="mb-3 text-sm font-semibold text-ink">Lifecycle for a scan</h3>
          <div className="mb-4 flex gap-2">
            <input
              value={scanId}
              onChange={(e) => setScanId(e.target.value)}
              placeholder="Run a scan first, or paste a scan_id"
              className="mono focus-ring flex-1 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-xs text-ink placeholder:font-sans placeholder:text-muted"
            />
            <Button variant="outline" size="sm" onClick={loadLifecycle}>
              Load
            </Button>
          </div>
          {lifecycle ? (
            <MemoryTimeline events={lifecycle.events} />
          ) : (
            <EmptyState
              title="No scan selected"
              hint="Run a scan to populate its lifecycle."
              icon={BrainCircuit}
            />
          )}
        </Panel>

        {/* Trigger operations */}
        <div className="space-y-5">
          <Panel>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
              <Sparkles className="h-4 w-4 text-low" /> Improve
            </h3>
            <p className="mb-3 text-xs text-muted">
              Enrich and link memories into scam clusters.
            </p>
            <Button variant="outline" onClick={runImprove} disabled={busy === "improve"} className="w-full">
              {busy === "improve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-low" />}
              Run improve
            </Button>
          </Panel>

          <Panel>
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-ink">
              <Eraser className="h-4 w-4 text-critical" /> Forget / Correct
            </h3>
            <p className="mb-3 text-xs text-muted">
              Downgrade false, duplicate, or stale claims.
            </p>
            <div className="flex gap-2">
              <select
                value={forgetReason}
                onChange={(e) => setForgetReason(e.target.value)}
                className="focus-ring flex-1 rounded-lg border border-line bg-surface-2/60 px-3 py-2 text-sm text-ink"
              >
                {["false_positive", "duplicate", "stale", "privacy"].map((r) => (
                  <option key={r} value={r} className="bg-surface">
                    {r.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <Button variant="danger" onClick={runForget} disabled={busy === "forget"}>
                {busy === "forget" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Run"}
              </Button>
            </div>
          </Panel>

          {actionResult && (
            <Panel>
              <h3 className="mb-3 text-sm font-semibold text-ink">Result</h3>
              <MemoryTimeline events={actionResult} />
            </Panel>
          )}
        </div>
      </div>

      {/* Session activity */}
      <Panel className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Session memory activity</h3>
        {memoryLog.length ? (
          <MemoryTimeline events={memoryLog.slice(0, 12)} />
        ) : (
          <p className="text-sm text-muted">No memory activity in this session yet.</p>
        )}
      </Panel>
    </div>
  );
}
