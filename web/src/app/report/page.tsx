"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FileWarning, ShieldQuestion, CheckCircle2, Share2, Radar } from "lucide-react";
import { api } from "@/lib/api";
import { store } from "@/lib/store";
import { PageHeader, Panel, Button } from "@/components/ui/primitives";
import { ReportForm } from "@/components/report/ReportForm";
import type { ReportPayload } from "@/lib/types";

function ReportInner() {
  const params = useSearchParams();
  const prefill = params.get("q") ?? "";
  const [pending, setPending] = useState(false);
  const [ack, setAck] = useState<{ report_id: string; entity_value?: string } | null>(null);

  async function submit(payload: ReportPayload) {
    setPending(true);
    const { data } = await api.submitReport(payload);
    store.logMemory([
      {
        event_type: "remember",
        summary: `Remembered unverified report for ${payload.value}`,
        reason: "User-submitted claim stored as pending; awaiting admin review.",
        timestamp: new Date().toISOString(),
      },
    ]);
    setAck(data as { report_id: string; entity_value?: string });
    setPending(false);
  }

  return (
    <div className="animate-rise mx-auto max-w-2xl">
      <PageHeader
        icon={FileWarning}
        title="Report a Scam"
        subtitle="Submit evidence — stored as an unverified claim until reviewed"
      />

      <div className="panel mb-5 flex gap-3 p-4">
        <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-suspicious" />
        <p className="text-sm text-ink-soft">
          Reports are treated as <span className="font-medium text-ink">unverified claims</span>.
          An admin reviews them before they affect risk scores — this keeps the memory
          graph from being polluted by false positives.
        </p>
      </div>

      {ack ? (
        <Panel className="text-center">
          <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-low" />
          <h3 className="text-lg font-semibold text-ink">Report submitted</h3>
          <p className="mt-1 text-sm text-muted">
            Saved as an unverified claim and remembered by Cognee.
          </p>
          <p className="mono mt-3 text-xs text-muted">Report ID: {ack.report_id}</p>
          <div className="mt-5 flex justify-center gap-2.5">
            {ack.entity_value && (
              <>
                <Link href={`/graph?q=${encodeURIComponent(ack.entity_value)}`}>
                  <Button variant="outline">
                    <Share2 className="h-4 w-4" /> View in graph
                  </Button>
                </Link>
                <Link href={`/scan?q=${encodeURIComponent(ack.entity_value)}`}>
                  <Button variant="ghost">
                    <Radar className="h-4 w-4" /> Scan entity
                  </Button>
                </Link>
              </>
            )}
            <Button variant="ghost" onClick={() => setAck(null)}>
              Submit another
            </Button>
          </div>
        </Panel>
      ) : (
        <ReportForm prefill={prefill} onSubmit={submit} pending={pending} />
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={null}>
      <ReportInner />
    </Suspense>
  );
}
