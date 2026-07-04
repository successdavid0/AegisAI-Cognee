"use client";
import Link from "next/link";
import {
  Radar, ScrollText, ShieldCheck, Clock, ShieldOff, Share2,
  ArrowUpRight, Activity, TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api";
import { useData } from "@/lib/useData";
import { useStore } from "@/lib/store";
import {
  Panel, RiskBadge, StatusPill, DataBadge, Skeleton, MonoValue, Button,
} from "@/components/ui/primitives";
import { truncateMiddle, relativeTime } from "@/lib/utils";
import { NODE_META } from "@/lib/risk";

export default function Dashboard() {
  const stats = useData(() => api.stats(), []);
  const scans = useData(() => api.recentScans(), []);
  const reports = useData(() => api.recentReports(), []);
  const memoryLog = useStore((s) => s.memoryLog);

  const s = stats.data;

  return (
    <div className="animate-rise">
      {/* Hero */}
      <div className="panel relative mb-7 overflow-hidden p-7">
        <div className="grid-faint absolute inset-0" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="max-w-xl">
            <div className="mb-3 flex items-center gap-2">
              <span className="chip">
                <Activity className="h-3 w-3 text-brand-2" /> Living memory graph
              </span>
              <DataBadge live={stats.live} />
            </div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">
              <span className="grad-text">Explainable scam intelligence</span>
              <br />
              backed by graph memory.
            </h1>
            <p className="mt-2.5 text-sm text-muted">
              Scan wallets, domains, URLs, contracts, handles and messages. See{" "}
              <span className="text-ink-soft">why</span> something is risky and how
              threats connect — powered by Cognee recall, remember, improve & forget.
            </p>
            <div className="mt-5 flex gap-2.5">
              <Link href="/scan">
                <Button variant="primary">
                  <Radar className="h-4 w-4" /> Scan an entity
                </Button>
              </Link>
              <Link href="/graph">
                <Button variant="outline">
                  <Share2 className="h-4 w-4" /> Explore graph
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi icon={Radar} label="Total scans" value={s?.total_scans} loading={stats.loading} tone="brand" />
        <Kpi icon={ScrollText} label="Reports" value={s?.total_reports} loading={stats.loading} />
        <Kpi icon={ShieldCheck} label="Verified scams" value={s?.verified_scams} loading={stats.loading} tone="critical" />
        <Kpi icon={Clock} label="Pending" value={s?.pending_reports} loading={stats.loading} tone="suspicious" />
        <Kpi icon={ShieldOff} label="FPs corrected" value={s?.false_positives_corrected} loading={stats.loading} tone="low" />
        <Kpi icon={Share2} label="Clusters" value={s?.scam_clusters} loading={stats.loading} />
      </div>

      {/* Activity grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Recent scans" href="/scan" icon={Radar} />
          {scans.loading ? (
            <SkeletonRows />
          ) : (
            <ul className="space-y-1">
              {scans.data?.map((sc, i) => {
                const meta = NODE_META[sc.input_type];
                return (
                  <li key={i}>
                    <Link
                      href={`/entity/${encodeURIComponent(sc.input_value)}`}
                      className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
                    >
                      <span className="text-base">{meta.icon}</span>
                      <MonoValue value={truncateMiddle(sc.input_value, 20, 8)} className="text-ink-soft" />
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-[11px] text-muted">{relativeTime(sc.timestamp)}</span>
                        <RiskBadge label={sc.risk_label} dot={false} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Recent reports" href="/admin" icon={ScrollText} />
          {reports.loading ? (
            <SkeletonRows />
          ) : (
            <ul className="space-y-1">
              {reports.data?.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/entity/${encodeURIComponent(r.entity_value)}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <MonoValue value={truncateMiddle(r.entity_value, 18, 6)} className="text-ink-soft" />
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-[11px] text-muted">{r.scam_type}</span>
                      <StatusPill status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Memory activity */}
      <Panel className="mt-5">
        <PanelHead title="Recent memory activity" href="/memory" icon={TrendingUp} />
        {memoryLog.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted">
            Cognee lifecycle events from scans and admin actions appear here.{" "}
            <Link href="/scan" className="text-brand-2 hover:underline">
              Run a scan
            </Link>{" "}
            to populate the timeline.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {memoryLog.slice(0, 6).map((ev, i) => (
              <li key={i} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <span className="chip capitalize">{ev.event_type}</span>
                <span className="text-ink-soft">{ev.summary}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

const TONE: Record<string, string> = {
  brand: "#7c5cff",
  critical: "#ff4d5e",
  suspicious: "#ffc53d",
  low: "#2ee6a6",
};

function Kpi({
  icon: Icon, label, value, loading, tone,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value?: number;
  loading: boolean;
  tone?: string;
}) {
  const color = tone ? TONE[tone] : undefined;
  return (
    <div className="panel panel-hover p-4">
      <Icon className="h-4 w-4" style={{ color: color ?? "#7b7c8c" }} />
      {loading ? (
        <Skeleton className="mt-2 h-7 w-14" />
      ) : (
        <div className="mt-2 text-2xl font-semibold tabular-nums" style={color ? { color } : undefined}>
          {value?.toLocaleString() ?? "—"}
        </div>
      )}
      <div className="mt-0.5 text-[11px] text-muted">{label}</div>
    </div>
  );
}

function PanelHead({
  title, href, icon: Icon,
}: {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="h-4 w-4 text-brand-2" />
        {title}
      </h3>
      <Link
        href={href}
        className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-ink-soft"
      >
        View all <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
