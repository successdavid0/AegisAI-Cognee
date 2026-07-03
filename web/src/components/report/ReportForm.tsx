"use client";
import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SCAM_TYPES } from "@/lib/risk";
import type { ReportPayload } from "@/lib/types";

export function ReportForm({
  prefill = "", onSubmit, pending,
}: {
  prefill?: string;
  onSubmit: (payload: ReportPayload) => void;
  pending?: boolean;
}) {
  const [value, setValue] = useState(prefill);
  const [scamType, setScamType] = useState(SCAM_TYPES[0]);
  const [confidence, setConfidence] = useState(0.7);
  const [description, setDescription] = useState("");
  const [reporter, setReporter] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return setErr("Enter the entity you are reporting.");
    if (!description.trim()) return setErr("Please describe what happened.");
    setErr(null);
    onSubmit({
      value: value.trim(),
      scam_type: scamType,
      confidence,
      description: description.trim(),
      reporter: reporter.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="panel space-y-4 p-6">
      <Field label="Entity (wallet / domain / URL / handle)">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="uniswap-airdrop-claim.io"
          className="input mono"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Scam type">
          <select
            value={scamType}
            onChange={(e) => setScamType(e.target.value)}
            className="input"
          >
            {SCAM_TYPES.map((t) => (
              <option key={t} value={t} className="bg-surface">
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Confidence · ${Math.round(confidence * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="mt-3 w-full accent-[#7c5cff]"
          />
        </Field>
      </div>

      <Field label="What happened? (evidence, links, context)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe how you encountered this and why you believe it is a scam."
          className="input resize-none"
        />
      </Field>

      <Field label="Your contact (optional)">
        <input
          value={reporter}
          onChange={(e) => setReporter(e.target.value)}
          placeholder="email or @handle"
          className="input"
        />
      </Field>

      {err && <p className="text-sm text-[#ff8a95]">{err}</p>}

      <Button type="submit" variant="primary" className="w-full" disabled={pending}>
        <Send className="h-4 w-4" />
        {pending ? "Submitting…" : "Submit report"}
      </Button>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid var(--color-line);
          background: rgba(255, 255, 255, 0.02);
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
          color: var(--color-ink);
          transition: border-color 0.15s ease;
        }
        .input::placeholder {
          color: var(--color-muted);
        }
        .input:focus {
          outline: none;
          border-color: rgba(124, 92, 255, 0.6);
          box-shadow: 0 0 0 3px rgba(124, 92, 255, 0.15);
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
