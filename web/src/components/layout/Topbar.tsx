"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, Command } from "lucide-react";

export function Topbar() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (!v) return;
    router.push(`/scan?q=${encodeURIComponent(v)}`);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-5 sm:px-8">
        <form onSubmit={submit} className="relative flex-1 max-w-xl">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Scan a wallet, domain, URL, @handle or message…"
            className="focus-ring w-full rounded-lg border border-line bg-surface/80 py-2 pl-9 pr-16 text-sm text-ink placeholder:text-muted"
          />
          <kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted sm:flex">
            <Command className="h-3 w-3" /> Enter
          </kbd>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <span className="chip">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-suspicious" />
            Demo data
          </span>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand/80 to-brand-2/80 text-xs font-semibold text-white">
            AE
          </div>
        </div>
      </div>
    </header>
  );
}
