"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, ArrowRight } from "lucide-react";
import { PageHeader, Panel, Button } from "@/components/ui/primitives";

const EXAMPLES = [
  "uniswap-airdrop-claim.io",
  "0x9a1f2c3d4e5f60718293a4b5c6d7e8f901234567",
  "@uniswap_airdrop_support",
];

export default function EntityLookupPage() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function go(v: string) {
    if (!v.trim()) return;
    router.push(`/entity/${encodeURIComponent(v.trim())}`);
  }

  return (
    <div className="animate-rise mx-auto max-w-2xl">
      <PageHeader
        icon={Fingerprint}
        title="Entity Lookup"
        subtitle="Open the full profile for any wallet, domain, URL, contract or handle"
      />
      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(value);
          }}
          className="flex gap-2"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Enter an entity value…"
            className="mono focus-ring flex-1 rounded-lg border border-line bg-surface-2/60 px-3.5 py-3 text-sm text-ink placeholder:font-sans placeholder:text-muted"
          />
          <Button type="submit" variant="primary">
            Open <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => go(ex)} className="chip mono hover:border-white/25">
              {ex}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
