"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Radar, Share2, Fingerprint } from "lucide-react";
import { api } from "@/lib/api";
import { useData } from "@/lib/useData";
import {
  PageHeader, Panel, Button, RiskBadge, DataBadge, StatusPill, Skeleton, EmptyState, MonoValue,
} from "@/components/ui/primitives";
import { MemoryTimeline } from "@/components/memory/MemoryTimeline";
import { ThreatGraph } from "@/components/graph/ThreatGraph";
import { ENTITY_TYPE_LABEL, riskColor } from "@/lib/risk";
import { pct, relativeTime, truncateMiddle } from "@/lib/utils";
import type { GraphData } from "@/lib/types";

const TABS = ["Reports", "Relationships", "Memory", "Scans", "Graph"] as const;
type Tab = (typeof TABS)[number];

export default function EntityDetailPage() {
  const params = useParams<{ value: string }>();
  const value = decodeURIComponent(
    Array.isArray(params.value) ? params.value[0] : params.value ?? "",
  );

  const entity = useData(() => api.entity(value), [value]);
  const [tab, setTab] = useState<Tab>("Reports");
  const [graph, setGraph] = useState<GraphData | null>(null);

  const e = entity.data;
  const color = e ? riskColor(e.risk_label) : "#7b7c8c";

  const counts = useMemo(
    () => ({
      Reports: e?.reports.length ?? 0,
      Relationships: e?.relationships.length ?? 0,
      Memory: e?.memory_events.length ?? 0,
      Scans: e?.scans.length ?? 0,
      Graph: 0,
    }),
    [e],
  );

  async function ensureGraph() {
    if (!graph && e) {
      const { data } = await api.graph(e.value);
      setGraph(data);
    }
  }

  return (
    <div className="animate-rise">
      <PageHeader
        icon={Fingerprint}
        title="Entity Detail"
        subtitle="Full profile: metadata, reports, relationships, memory"
        actions={<DataBadge live={entity.live} />}
      />

      {entity.loading || !e ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          {/* Header card */}
          <div className="panel relative overflow-hidden p-6" style={{ borderColor: `${color}33` }}>
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-30 blur-3xl"
              style={{ background: color }}
            />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <RiskBadge label={e.risk_label} />
                  <span className="chip">{ENTITY_TYPE_LABEL[e.type]}</span>
                </div>
                <p className="mono mt-2.5 break-all text-lg text-ink">{e.value}</p>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Link href={`/scan?q=${encodeURIComponent(e.value)}`}>
                    <Button variant="outline" size="sm">
                      <Radar className="h-3.5 w-3.5 text-brand-2" /> Scan
                    </Button>
                  </Link>
                  <Link href={`/graph?q=${encodeURIComponent(e.value)}`}>
                    <Button variant="ghost" size="sm">
                      <Share2 className="h-3.5 w-3.5" /> Graph
                    </Button>
                  </Link>
                </div>
              </div>
              {typeof e.risk_score === "number" && (
                <div className="text-right">
                  <div className="text-4xl font-bold" style={{ color }}>
                    {e.risk_score}
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted">/ 100 risk</div>
                </div>
              )}
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta label="Status" value={(e.status ?? "unknown").replace(/_/g, " ")} />
              <Meta label="Chain" value={e.chain ?? "—"} />
              <Meta label="Confidence" value={pct(e.confidence)} />
              <Meta label="First seen" value={e.first_seen ?? "—"} />
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  if (t === "Graph") ensureGraph();
                }}
                className={`relative px-3.5 py-2.5 text-sm transition-colors ${
                  tab === t ? "text-ink" : "text-muted hover:text-ink-soft"
                }`}
              >
                {t}
                {counts[t] > 0 && <span className="ml-1.5 text-xs text-muted">{counts[t]}</span>}
                {tab === t && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-brand to-brand-2" />
                )}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "Reports" &&
              (e.reports.length ? (
                <div className="space-y-3">
                  {e.reports.map((r) => (
                    <Panel key={r.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-brand-2">{r.scam_type}</span>
                        <StatusPill status={r.status} />
                        <span className="ml-auto text-[11px] text-muted">
                          {relativeTime(r.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-ink-soft">{r.description}</p>
                    </Panel>
                  ))}
                </div>
              ) : (
                <EmptyState title="No reports for this entity." />
              ))}

            {tab === "Relationships" &&
              (e.relationships.length ? (
                <div className="space-y-2">
                  {e.relationships.map((rel) => (
                    <Link
                      key={rel.id}
                      href={`/entity/${encodeURIComponent(rel.value)}`}
                      className="panel flex items-center gap-3 p-3.5 transition-colors hover:border-line-strong"
                    >
                      <span className="chip">{rel.relationship?.replace(/_/g, " ")}</span>
                      <MonoValue value={truncateMiddle(rel.value, 18, 8)} className="text-ink-soft" />
                      <span className="ml-auto">
                        <RiskBadge label={rel.risk_label} dot={false} />
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title="No relationships recorded." />
              ))}

            {tab === "Memory" && <MemoryTimeline events={e.memory_events} />}

            {tab === "Scans" &&
              (e.scans.length ? (
                <div className="space-y-2">
                  {e.scans.map((sc, i) => (
                    <Panel key={i} className="flex items-center gap-3">
                      <MonoValue value={truncateMiddle(sc.input_value, 22, 8)} className="text-ink-soft" />
                      <span className="ml-auto flex items-center gap-2">
                        <span className="text-[11px] text-muted">{relativeTime(sc.timestamp)}</span>
                        <RiskBadge label={sc.risk_label} dot={false} />
                      </span>
                    </Panel>
                  ))}
                </div>
              ) : (
                <EmptyState title="No scans recorded for this entity." />
              ))}

            {tab === "Graph" &&
              (graph ? (
                <ThreatGraph graph={graph} height={440} />
              ) : (
                <Skeleton className="h-[440px] w-full" />
              ))}
          </div>
        </>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium capitalize text-ink">{value}</div>
    </div>
  );
}
