"use client";
import { riskColor } from "@/lib/risk";
import type { RiskLabel } from "@/lib/types";

/** Semicircular risk gauge, 0–100, colored by label. */
export function RiskGauge({
  score, label, size = 172,
}: {
  score: number;
  label: RiskLabel;
  size?: number;
}) {
  const color = riskColor(label);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const cy = size / 2;
  const circumference = Math.PI * r; // half circle
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size / 2 + 20 }}>
      <svg width={size} height={size / 2 + 20} className="overflow-visible">
        <defs>
          <linearGradient id="riskg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        {/* track */}
        <path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* value */}
        <path
          d={`M ${stroke / 2} ${cy} A ${r} ${r} 0 0 1 ${size - stroke / 2} ${cy}`}
          fill="none"
          stroke="url(#riskg)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            filter: `drop-shadow(0 0 10px ${color}66)`,
            transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)",
          }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span
          className="text-[2.6rem] font-bold leading-none tracking-tight"
          style={{ color }}
        >
          {clamped}
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-widest text-muted">
          / 100 risk
        </span>
      </div>
    </div>
  );
}
