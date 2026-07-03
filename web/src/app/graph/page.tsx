"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Share2, Radar } from "lucide-react";
import { api } from "@/lib/api";
import {
  PageHeader, Panel, Button, DataBadge, RiskBadge, EmptyState, MonoValue,
} from "@/components/ui/primitives";
import { ThreatGraph } from "@/components/graph/ThreatGraph";
import { NODE_META } from "@/lib/risk";
import { truncateMiddle, pct } from "@/lib/utils";
import type { GraphData, GraphNode } from "@/lib/types";

const LEGEND: (keyof typeof NODE_META)[] = [
  "wallet", "domain", "url", "contract", "handle", "cluster",
];

function GraphInner() {
  const params = useSearchParams();
  const initial = params.get("q") ?? "uniswap-airdrop-claim.io";

  const [value, setValue] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [depth, setDepth] = useState(1);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [live, setLive] = useState(false);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    let active = true;
    api.graph(query, depth).then(({ data, live }) => {
      if (!active) return;
      setGraph(data);
      setLive(live);
      setSelected(null);
    });
    return () => {
      active = false;
    };
  }, [query, depth]);

  return (
    <div className="animate-rise">
      <PageHeader
        icon={Share2}
        title="Threat Graph"
        subtitle="Trace how wallets, domains, handles and clusters connect"
        actions={<DataBadge live={live} />}
      />

      {/* Controls */}
      <div className="panel mb-5 flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && setQuery(value.trim())}
          placeholder="Entity to center the graph on"
          className="mono focus-ring flex-1 rounded-lg border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm text-ink placeholder:font-sans placeholder:text-muted"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Depth</span>
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              onClick={() => setDepth(d)}
              className={`focus-ring h-8 w-8 rounded-lg border text-sm transition-colors ${
                depth === d
                  ? "border-brand/50 bg-brand/15 text-ink"
                  : "border-line text-muted hover:bg-white/[0.04]"
              }`}
            >
              {d}
            </button>
          ))}
          <Button variant="primary" size="sm" onClick={() => setQuery(value.trim())}>
            Build
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          {graph && graph.nodes.length > 0 ? (
            <ThreatGraph graph={graph} onSelect={setSelected} />
          ) : (
            <Panel>
              <EmptyState title="No related graph found for this entity." icon={Share2} />
            </Panel>
          )}
          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-3 px-1">
            {LEGEND.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-muted">
                <span>{NODE_META[t].icon}</span>
                {NODE_META[t].label}
              </span>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-5">
          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-ink">Node detail</h3>
            {selected ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <RiskBadge label={selected.risk_label} />
                  <span className="chip capitalize">{selected.type}</span>
                </div>
                <MonoValue value={selected.value} className="block text-ink" />
                {typeof selected.risk_score === "number" && (
                  <div className="rounded-lg border border-line bg-surface-2/60 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted">
                      Risk score
                    </div>
                    <div className="text-xl font-semibold text-ink">
                      {selected.risk_score}/100
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Link href={`/entity/${encodeURIComponent(selected.value)}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      Entity detail
                    </Button>
                  </Link>
                  <Link href={`/scan?q=${encodeURIComponent(selected.value)}`} className="flex-1">
                    <Button variant="ghost" size="sm" className="w-full">
                      <Radar className="h-3.5 w-3.5" /> Scan
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Click a node in the graph to inspect it.</p>
            )}
          </Panel>

          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-ink">
              Relationships{" "}
              <span className="text-muted">({graph?.edges.length ?? 0})</span>
            </h3>
            <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
              {graph?.edges.map((e, i) => {
                const from = graph.nodes.find((n) => n.id === e.from);
                const to = graph.nodes.find((n) => n.id === e.to);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-md border border-line bg-surface-2/40 px-2.5 py-2 text-[11px]"
                  >
                    <span className="mono truncate text-ink-soft">
                      {truncateMiddle(from?.value ?? "", 8, 4)}
                    </span>
                    <span className="text-brand-2">{e.relationship_type.replace(/_/g, " ")}</span>
                    <span className="mono truncate text-ink-soft">
                      {truncateMiddle(to?.value ?? "", 8, 4)}
                    </span>
                    <span className="ml-auto text-muted">{pct(e.confidence)}</span>
                  </div>
                );
              })}
              {!graph?.edges.length && (
                <p className="text-sm text-muted">No relationships in this view.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

export default function GraphPage() {
  return (
    <Suspense fallback={null}>
      <GraphInner />
    </Suspense>
  );
}
