"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Activity, RefreshCw, Server, Database, BrainCircuit, KeyRound,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, Button } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/utils";
import type { SystemStatus } from "@/lib/types";

type Health = "ok" | "warn" | "down";

const TONE: Record<Health, { color: string; Icon: typeof CheckCircle2; label: string }> = {
  ok: { color: "#2ee6a6", Icon: CheckCircle2, label: "Connected" },
  warn: { color: "#ffc53d", Icon: AlertTriangle, label: "Degraded" },
  down: { color: "#ff4d5e", Icon: XCircle, label: "Disconnected" },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function SettingsPage() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api.status();
    setData(res.data);
    setLive(res.live);
    setCheckedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 10_000); // auto-refresh every 10s
    return () => clearInterval(id);
  }, [load]);

  const c = data?.cognee;
  const apiHealth: Health = live && data?.api.ok ? "ok" : "down";
  const dbHealth: Health = live && data?.database.connected ? "ok" : "down";
  const cogHealth: Health = !live
    ? "down"
    : c?.reachable
      ? "ok"
      : c?.enabled
        ? "down"
        : "warn";
  const authHealth: Health = !live ? "down" : data?.admin_auth_ready ? "ok" : "warn";

  const allOk = apiHealth === "ok" && dbHealth === "ok" && cogHealth === "ok";
  const banner: Health = !live ? "down" : allOk ? "ok" : "warn";
  const B = TONE[banner];

  return (
    <div className="animate-rise">
      <PageHeader
        icon={Activity}
        title="System Status"
        subtitle="Live connectivity to the backend, database, and Cognee memory"
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-check
          </Button>
        }
      />

      {/* Overall banner */}
      <div
        className="panel mb-6 flex items-center gap-3 p-5"
        style={{ borderColor: `${B.color}44`, background: `${B.color}0d` }}
      >
        <B.Icon className="h-6 w-6 shrink-0" style={{ color: B.color }} />
        <div>
          <div className="text-base font-semibold" style={{ color: B.color }}>
            {banner === "ok"
              ? "All systems connected"
              : banner === "warn"
                ? "Some services need attention"
                : "Not connected to the live backend"}
          </div>
          <div className="mt-0.5 text-xs text-muted">
            {checkedAt ? `Last checked ${relativeTime(checkedAt)} · auto-refreshes every 10s` : "Checking…"}
          </div>
        </div>
      </div>

      {/* Service cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        <StatusCard
          icon={Server}
          title="Backend API"
          health={apiHealth}
          lines={[
            ["Endpoint", API_URL],
            live && data
              ? ["Version", `v${data.api.version} · ${data.api.env}`]
              : ["Reason", "No response from the API"],
          ]}
        />
        <StatusCard
          icon={Database}
          title="Database"
          health={dbHealth}
          lines={
            live && data?.database.connected
              ? [
                  ["Engine", data.database.engine ?? "—"],
                  ["Records", `${data.database.entities ?? 0} entities · ${data.database.reports ?? 0} reports · ${data.database.clusters ?? 0} clusters`],
                ]
              : [["Reason", data?.database.error ?? "Not reachable via the API"]]
          }
        />
        <StatusCard
          icon={BrainCircuit}
          title="Cognee Memory"
          health={cogHealth}
          lines={
            !live
              ? [["Reason", "Backend offline — cannot check"]]
              : c?.reachable
                ? [
                    ["Mode", c.mode],
                    ["Dataset", c.dataset],
                    [
                      "Records",
                      c.records != null
                        ? `${c.records.toLocaleString()} memories${c.processing_status === "DATASET_PROCESSING_STARTED" ? " · cognify in progress" : ""}`
                        : "count unavailable",
                    ],
                    ["Latency", `${c.latency_ms ?? "?"} ms`],
                    ["Host", c.base_url ?? "—"],
                  ]
                : c?.enabled
                  ? [["Mode", c.mode], ["Error", c.error ?? "Unreachable"]]
                  : [["Mode", "local-simulation"], ["Note", "No Cognee credentials set — running offline"]]
          }
        />
        <StatusCard
          icon={KeyRound}
          title="Admin Auth"
          health={authHealth}
          lines={
            !live
              ? [["Reason", "Backend offline"]]
              : data?.admin_auth_ready
                ? [["Status", "Protected — admin key required"]]
                : [["Status", "Open (development)"], ["Note", "Set ADMIN_API_KEY in production"]]
          }
        />
      </div>
    </div>
  );
}

function StatusCard({
  icon: Icon, title, health, lines,
}: {
  icon: typeof Server;
  title: string;
  health: Health;
  lines: [string, string][];
}) {
  const t = TONE[health];
  return (
    <div className="panel p-5" style={{ borderColor: `${t.color}22` }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Icon className="h-4 w-4 text-brand-2" />
          {title}
        </h3>
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{ color: t.color, background: `${t.color}14`, border: `1px solid ${t.color}33` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.color, boxShadow: `0 0 8px ${t.color}` }} />
          {t.label}
        </span>
      </div>
      <dl className="space-y-1.5">
        {lines.map(([k, v]) => (
          <div key={k} className="flex gap-3 text-xs">
            <dt className="w-20 shrink-0 text-muted">{k}</dt>
            <dd className="mono break-all text-ink-soft">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
