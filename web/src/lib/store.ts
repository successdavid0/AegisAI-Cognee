"use client";
// Minimal module-singleton store (via useSyncExternalStore) for UI-only state:
// the last scan and a running memory-activity log. Business state stays in the
// backend — this only powers cross-page UX (Frontend Spec §8).
import { useSyncExternalStore } from "react";
import type { MemoryEvent, ScanResult } from "./types";

interface AppState {
  latestScan: ScanResult | null;
  memoryLog: MemoryEvent[];
}

let state: AppState = { latestScan: null, memoryLog: [] };
const listeners = new Set<() => void>();

function emit() {
  state = { ...state };
  listeners.forEach((l) => l());
}

export const store = {
  setLatestScan(scan: ScanResult) {
    state.latestScan = scan;
    emit();
  },
  logMemory(events: MemoryEvent[]) {
    if (!events?.length) return;
    state.memoryLog = [...events, ...state.memoryLog].slice(0, 50);
    emit();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get() {
    return state;
  },
};

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(state),
  );
}
