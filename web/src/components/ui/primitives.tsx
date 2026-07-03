"use client";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RISK } from "@/lib/risk";
import type { RiskLabel } from "@/lib/types";

/* ---------- PageHeader ---------- */
export function PageHeader({
  title, subtitle, icon: Icon, actions,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3.5">
        {Icon && (
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-line bg-surface-2">
            <Icon className="h-5 w-5 text-brand-2" strokeWidth={2} />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Button ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
};
export function Button({
  variant = "outline", size = "md", className, ...props
}: BtnProps) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm",
        variant === "primary" &&
          "bg-gradient-to-b from-brand to-[#6a48f0] text-white shadow-[0_8px_24px_-10px_rgba(124,92,255,0.9)] hover:brightness-110",
        variant === "outline" &&
          "border border-line-strong bg-white/[0.02] text-ink hover:border-white/25 hover:bg-white/[0.05]",
        variant === "ghost" && "text-ink-soft hover:bg-white/[0.05] hover:text-ink",
        variant === "danger" &&
          "border border-critical/30 bg-critical/10 text-[#ff8a95] hover:bg-critical/20",
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Panel ---------- */
export function Panel({
  className, children, hover,
}: {
  className?: string;
  children: React.ReactNode;
  hover?: boolean;
}) {
  return (
    <div className={cn("panel p-5", hover && "panel-hover", className)}>{children}</div>
  );
}

/* ---------- RiskBadge ---------- */
export function RiskBadge({
  label, className, dot = true,
}: {
  label: RiskLabel;
  className?: string;
  dot?: boolean;
}) {
  const r = RISK[label] ?? RISK.Unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        className,
      )}
      style={{
        color: r.color,
        borderColor: `${r.color}44`,
        background: `${r.color}14`,
      }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: r.color, boxShadow: `0 0 8px ${r.glow}` }}
        />
      )}
      {label}
    </span>
  );
}

/* ---------- StatusPill (report status) ---------- */
const STATUS_COLOR: Record<string, string> = {
  pending: "#ffc53d",
  verified: "#ff4d5e",
  rejected: "#7b7c8c",
  false_positive: "#2ee6a6",
  duplicate: "#5b8def",
};
export function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#7b7c8c";
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize"
      style={{ color, background: `${color}18`, border: `1px solid ${color}33` }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

/* ---------- DataBadge (live vs demo) ---------- */
export function DataBadge({ live }: { live: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold",
        live
          ? "bg-low/10 text-low"
          : "bg-suspicious/10 text-suspicious",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          live ? "bg-low" : "animate-pulse bg-suspicious",
        )}
      />
      {live ? "Live backend" : "Demo data"}
    </span>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({
  title, hint, icon: Icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line py-12 text-center">
      {Icon && <Icon className="mb-3 h-7 w-7 text-muted" />}
      <p className="text-sm text-ink-soft">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-white/[0.04]",
        className,
      )}
    />
  );
}

/* ---------- MonoValue (addresses/domains) ---------- */
export function MonoValue({
  value, href, className,
}: {
  value: string;
  href?: string;
  className?: string;
}) {
  const inner = <span className={cn("mono break-all text-sm", className)}>{value}</span>;
  return href ? (
    <Link href={href} className="text-brand-2 hover:underline">
      {inner}
    </Link>
  ) : (
    inner
  );
}
