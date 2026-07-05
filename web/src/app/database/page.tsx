"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Database, Search, ChevronLeft, ChevronRight, Loader2, ShieldAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, relativeTime } from "@/lib/utils";
import {
  PageHeader, Button, RiskBadge, StatusPill, DataBadge, MonoValue, EmptyState, Skeleton,
} from "@/components/ui/primitives";
import type { EntityListPage, EntityListQuery } from "@/lib/types";

const PAGE_SIZE = 50;

const TYPE_TABS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "domain", label: "Domains" },
  { key: "wallet", label: "Wallets / Contracts" },
  { key: "handle", label: "Handles" },
  { key: "url", label: "URLs" },
];

const RISK_TABS = ["", "Critical", "High Risk", "Suspicious", "Low Risk", "Unknown"] as const;

const SORTS: { key: NonNullable<EntityListQuery["sort"]>; label: string }[] = [
  { key: "risk", label: "Most threatening" },
  { key: "reports", label: "Most reported" },
  { key: "recent", label: "Recently seen" },
  { key: "value", label: "A – Z" },
];

export default function DatabasePage() {
  const [data, setData] = useState<EntityListPage | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [risk, setRisk] = useState("");
  const [sort, setSort] = useState<NonNullable<EntityListQuery["sort"]>>("risk");
  const [page, setPage] = useState(1);

  // Debounced fetch — one in-flight request wins (stale responses discarded).
  const seq = useRef(0);
  const load = useCallback(async (query: EntityListQuery) => {
    const my = ++seq.current;
    setLoading(true);
    const res = await api.entityList(query);
    if (my !== seq.current) return;
    setData(res.data);
    setLive(res.live);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(
      () => load({ q, type, risk, sort, page, page_size: PAGE_SIZE }),
      q ? 300 : 0,
    );
    return () => clearTimeout(t);
  }, [q, type, risk, sort, page, load]);

  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const resetPage = () => setPage(1);

  return (
    <div className="animate-rise">
      <PageHeader
        icon={Database}
        title="Threat Database"
        subtitle="Every indicator in the system — scam domains, wallets, contracts, and handles"
        actions={<DataBadge live={live} />}
      />

      {/* Controls */}
      <div className="panel mb-4 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); resetPage(); }}
              placeholder="Search addresses, domains, handles…"
              className="focus-ring w-full rounded-lg border border-line bg-white/[0.02] py-2 pl-9 pr-3 text-sm text-ink placeholder:text-muted"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as typeof sort); resetPage(); }}
            className="focus-ring rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>Sort: {s.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_TABS.map((t) => (
            <FilterChip key={t.key} active={type === t.key} onClick={() => { setType(t.key); resetPage(); }}>
              {t.label}
            </FilterChip>
          ))}
          <span className="mx-2 h-4 w-px bg-line" />
          {RISK_TABS.map((r) => (
            <FilterChip key={r || "all"} active={risk === r} onClick={() => { setRisk(r); resetPage(); }}>
              {r || "Any risk"}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="panel overflow-x-auto p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-xs text-muted">
            {loading && !data ? "Loading…" : `${total.toLocaleString()} indicators${q || type || risk ? " match" : ""}`}
          </p>
          {loading && data && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
        </div>

        {!data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : data.items.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No indicators match these filters." icon={ShieldAlert} />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5 font-medium">Indicator</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Risk</th>
                <th className="px-3 py-2.5 font-medium">Scam type</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-right font-medium">Reports</th>
                <th className="px-4 py-2.5 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((e) => (
                <tr key={e.id} className="border-b border-line/50 transition-colors hover:bg-white/[0.03]">
                  <td className="max-w-[340px] px-4 py-2.5">
                    <MonoValue
                      value={e.value.length > 46 ? `${e.value.slice(0, 43)}…` : e.value}
                      href={`/entity/${encodeURIComponent(e.value)}`}
                    />
                    {e.chain && <span className="ml-2 text-[10px] uppercase text-muted">{e.chain}</span>}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-ink-soft">{e.type}</td>
                  <td className="px-3 py-2.5">
                    <RiskBadge label={e.risk_label} />
                    {e.risk_score != null && (
                      <span className="ml-1.5 text-[11px] text-muted">{e.risk_score}/100</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 capitalize text-ink-soft">
                    {e.scam_type?.replace(/_/g, " ") ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">{e.status ? <StatusPill status={e.status} /> : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-ink-soft">{e.report_count}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted">
                    {e.last_seen ? relativeTime(e.last_seen) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-xs text-muted">
            Page {data?.page ?? page} of {pages}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "focus-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-brand/50 bg-brand/15 text-brand-2"
          : "border-line bg-white/[0.02] text-muted hover:border-white/20 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
