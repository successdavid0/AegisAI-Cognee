"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Radar, Loader2, Share2, FileWarning, BrainCircuit } from "lucide-react";
import { api } from "@/lib/api";
import { store } from "@/lib/store";
import { PageHeader, Panel, Button, DataBadge, EmptyState } from "@/components/ui/primitives";
import { RiskCard } from "@/components/scan/RiskCard";
import { ReasonList, EvidenceTable, RelatedEntities } from "@/components/scan/ScanDetails";
import { MemoryTimeline } from "@/components/memory/MemoryTimeline";
import type { Lifecycle, ScanResult } from "@/lib/types";

function ScanInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initial = params.get("q") ?? "";

  const [value, setValue] = useState(initial);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(false);

  const runScan = useCallback(async (input: string) => {
    const v = input.trim();
    if (!v) return;
    setLoading(true);
    const { data, live } = await api.scan(v);
    setScan(data);
    setLive(live);
    store.setLatestScan(data);
    const lc = await api.lifecycle(data.scan_id);
    setLifecycle(lc.data);
    store.logMemory(lc.data.events);
    setLoading(false);
  }, []);

  // Auto-run when arriving with ?q= — kicking off the scan (and its loading
  // state) is the intended side effect here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) runScan(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    router.replace(`/scan?q=${encodeURIComponent(value.trim())}`);
    runScan(value);
  }

  return (
    <div className="animate-rise">
      <PageHeader
        icon={Radar}
        title="Scan Entity"
        subtitle="Get an explainable risk verdict backed by graph memory"
      />

      {/* Input */}
      <form onSubmit={submit} className="panel mb-6 flex flex-col gap-3 p-4 sm:flex-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Wallet 0x…, domain, https URL, @handle, or paste a suspicious message"
          className="mono focus-ring w-full flex-1 rounded-lg border border-line bg-surface-2/60 px-3.5 py-3 text-sm text-ink placeholder:font-sans placeholder:text-muted"
        />
        <Button type="submit" variant="primary" disabled={loading} className="sm:w-36">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
          {loading ? "Scanning" : "Scan"}
        </Button>
      </form>

      {!scan && !loading && (
        <div className="space-y-4">
          <EmptyState
            icon={Radar}
            title="Enter something to scan"
            hint="Try a demo input below to see a full verdict, graph, and memory timeline."
          />
          <div className="flex flex-wrap gap-2">
            {[
              "uniswap-airdrop-claim.io",
              "0x9a1f2c3d4e5f60718293a4b5c6d7e8f901234567",
              "@uniswap_airdrop_support",
            ].map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setValue(ex);
                  router.replace(`/scan?q=${encodeURIComponent(ex)}`);
                  runScan(ex);
                }}
                className="chip mono hover:border-white/25"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {scan && (
        <div className="animate-rise space-y-6">
          <div className="flex items-center justify-between">
            <DataBadge live={live} />
          </div>

          <RiskCard scan={scan} />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <ReasonList reasons={scan.reasons} />
              <RelatedEntities items={scan.related_entities} />
            </div>
            <div className="space-y-5">
              <EvidenceTable evidence={scan.evidence} />
              <Panel>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                  <BrainCircuit className="h-4 w-4 text-brand-2" />
                  Memory lifecycle preview
                </h3>
                <MemoryTimeline
                  events={lifecycle?.events?.slice(0, 3) ?? scan.lifecycle_preview}
                />
                <Link
                  href="/memory"
                  className="mt-3 inline-block text-xs text-brand-2 hover:underline"
                >
                  See full lifecycle →
                </Link>
              </Panel>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <Link href={`/graph?q=${encodeURIComponent(scan.input_value)}`}>
              <Button variant="outline">
                <Share2 className="h-4 w-4 text-brand-2" /> Open threat graph
              </Button>
            </Link>
            <Link href={`/report?q=${encodeURIComponent(scan.input_value)}`}>
              <Button variant="outline">
                <FileWarning className="h-4 w-4 text-suspicious" /> Report this entity
              </Button>
            </Link>
            <Link href={`/entity/${encodeURIComponent(scan.input_value)}`}>
              <Button variant="ghost">Full entity detail →</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanInner />
    </Suspense>
  );
}
