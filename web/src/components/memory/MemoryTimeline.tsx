"use client";
import { Search, Brain, Sparkles, Eraser } from "lucide-react";
import { EmptyState } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/utils";
import type { MemoryEvent, MemoryEventType } from "@/lib/types";

const META: Record<
  MemoryEventType,
  { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; title: string }
> = {
  recall: { icon: Search, color: "#5b8def", title: "Recall" },
  remember: { icon: Brain, color: "#9b7bff", title: "Remember" },
  improve: { icon: Sparkles, color: "#2ee6a6", title: "Improve" },
  forget: { icon: Eraser, color: "#ff4d5e", title: "Forget / Correct" },
};

export function MemoryTimeline({ events }: { events: MemoryEvent[] }) {
  if (!events || events.length === 0) {
    return <EmptyState title="No memory operations recorded yet." icon={Brain} />;
  }
  return (
    <ol className="relative space-y-3 pl-1">
      {events.map((ev, i) => {
        const m = META[ev.event_type] ?? META.recall;
        const Icon = m.icon;
        const last = i === events.length - 1;
        return (
          <li key={ev.id ?? i} className="relative flex gap-3.5">
            <div className="flex flex-col items-center">
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border"
                style={{
                  background: `${m.color}18`,
                  borderColor: `${m.color}44`,
                  boxShadow: `0 0 14px -4px ${m.color}`,
                }}
              >
                <Icon className="h-4 w-4" style={{ color: m.color }} />
              </span>
              {!last && <span className="mt-1 w-px flex-1 bg-line" />}
            </div>
            <div className="panel flex-1 p-3.5" style={{ borderColor: `${m.color}22` }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: m.color }}>
                  {m.title}
                </span>
                {ev.timestamp && (
                  <span className="text-[11px] text-muted">
                    {relativeTime(ev.timestamp)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink">{ev.summary}</p>
              <p className="mt-0.5 text-xs text-muted">{ev.reason}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
