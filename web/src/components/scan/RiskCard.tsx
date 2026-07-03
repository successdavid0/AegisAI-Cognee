"use client";
import { RiskGauge } from "@/components/ui/RiskGauge";
import { RiskBadge } from "@/components/ui/primitives";
import { ENTITY_TYPE_LABEL, riskColor } from "@/lib/risk";
import { pct } from "@/lib/utils";
import type { ScanResult } from "@/lib/types";

export function RiskCard({ scan }: { scan: ScanResult }) {
  const color = riskColor(scan.risk_label);
  return (
    <div
      className="panel relative overflow-hidden p-6"
      style={{ borderColor: `${color}33` }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
        style={{ background: color }}
      />
      <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <RiskGauge score={scan.risk_score} label={scan.risk_label} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
              {ENTITY_TYPE_LABEL[scan.input_type]}
            </span>
            <RiskBadge label={scan.risk_label} />
          </div>
          <p className="mono mt-2 break-all text-[15px] text-ink">
            {scan.input_value}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <Stat label="Risk score" value={`${scan.risk_score}`} accent={color} />
            <Stat label="Confidence" value={pct(scan.confidence)} />
            <Stat label="Signals" value={`${scan.reasons.length}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/60 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div
        className="mt-0.5 text-lg font-semibold"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
