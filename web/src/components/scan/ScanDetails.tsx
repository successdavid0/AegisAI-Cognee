"use client";
import Link from "next/link";
import { ArrowUpRight, ShieldAlert, FileText, Link2 } from "lucide-react";
import { Panel, RiskBadge, EmptyState, MonoValue } from "@/components/ui/primitives";
import { NODE_META } from "@/lib/risk";
import { truncateMiddle, pct } from "@/lib/utils";
import type { Reason, Evidence, RelatedEntity } from "@/lib/types";

export function ReasonList({ reasons }: { reasons: Reason[] }) {
  return (
    <Panel>
      <SectionTitle icon={ShieldAlert}>Why this verdict</SectionTitle>
      {reasons.length === 0 ? (
        <EmptyState title="No contributing signals returned." />
      ) : (
        <ul className="space-y-1">
          {reasons.map((r, i) => {
            const positive = r.weight > 0;
            const negative = r.weight < 0;
            return (
              <li
                key={i}
                className="flex items-center justify-between border-b border-line py-2.5 last:border-0"
              >
                <span className="text-sm text-ink-soft">{r.text}</span>
                <span
                  className="mono shrink-0 text-sm font-semibold"
                  style={{
                    color: positive ? "#ff8a95" : negative ? "#2ee6a6" : "#7b7c8c",
                  }}
                >
                  {positive ? `+${r.weight}` : r.weight}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

export function EvidenceTable({ evidence }: { evidence: Evidence[] }) {
  return (
    <Panel>
      <SectionTitle icon={FileText}>Evidence</SectionTitle>
      {evidence.length === 0 ? (
        <EmptyState title="No supporting evidence on record." />
      ) : (
        <div className="space-y-2.5">
          {evidence.map((e, i) => (
            <div
              key={i}
              className="rounded-lg border border-line bg-surface-2/50 p-3"
            >
              <p className="text-sm text-ink">{e.description}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                <span className="chip">{e.source}</span>
                <span>{e.source_type.replace(/_/g, " ")}</span>
                <span className="ml-auto">reliability {pct(e.reliability)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function RelatedEntities({ items }: { items: RelatedEntity[] }) {
  return (
    <Panel>
      <SectionTitle icon={Link2}>Related entities</SectionTitle>
      {items.length === 0 ? (
        <EmptyState title="No connected entities found in memory." />
      ) : (
        <ul className="space-y-1.5">
          {items.map((r) => {
            const meta = NODE_META[r.type];
            return (
              <li key={r.id}>
                <Link
                  href={`/entity/${encodeURIComponent(r.value)}`}
                  className="group flex items-center gap-3 rounded-lg border border-line bg-surface-2/40 px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-white/[0.04]"
                >
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm"
                    style={{ background: `${meta.color}1a`, border: `1px solid ${meta.color}33` }}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <MonoValue value={truncateMiddle(r.value, 16, 8)} className="text-ink" />
                    {r.relationship && (
                      <div className="text-[11px] text-muted">
                        {r.relationship.replace(/_/g, " ")}
                        {r.confidence ? ` · ${pct(r.confidence)}` : ""}
                      </div>
                    )}
                  </div>
                  <RiskBadge label={r.risk_label} dot={false} />
                  <ArrowUpRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function SectionTitle({
  icon: Icon, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <h3 className="mb-3.5 flex items-center gap-2 text-sm font-semibold text-ink">
      <Icon className="h-4 w-4 text-brand-2" />
      {children}
    </h3>
  );
}
