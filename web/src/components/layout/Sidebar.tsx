"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Radar, Share2, FileWarning, BrainCircuit,
  ShieldCheck, Fingerprint, ShieldHalf, Activity, Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "Scan", icon: Radar },
  { href: "/graph", label: "Threat Graph", icon: Share2 },
  { href: "/database", label: "Threat Database", icon: Database },
  { href: "/report", label: "Report Scam", icon: FileWarning },
  { href: "/memory", label: "Memory Lifecycle", icon: BrainCircuit },
  { href: "/admin", label: "Admin Review", icon: ShieldCheck },
  { href: "/entity", label: "Entity Lookup", icon: Fingerprint },
  { href: "/settings", label: "System Status", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-surface/60 backdrop-blur-xl md:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
        <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-2 shadow-[0_0_24px_-4px_rgba(124,92,255,0.7)]">
          <ShieldHalf className="h-5 w-5 text-white" strokeWidth={2.2} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-[16px] font-semibold tracking-[0.08em] text-ink">
            AE<span className="text-brand-2">GIS</span>
          </span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
            Scam Intelligence
          </span>
        </span>
      </Link>

      <nav className="mt-2 flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "focus-ring group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-brand/10 text-ink"
                  : "text-ink-soft hover:bg-white/[0.03] hover:text-ink",
              )}
            >
              {active && (
                <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-gradient-to-b from-brand to-brand-2" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  active ? "text-brand-2" : "text-muted group-hover:text-ink-soft",
                )}
                strokeWidth={2}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-line bg-surface-2/70 p-3.5">
        <div className="flex items-center gap-2 text-xs font-medium text-ink">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-suspicious" />
          Demo mode
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
          Running on seeded threat data. Connect the backend to go live.
        </p>
      </div>
    </aside>
  );
}
