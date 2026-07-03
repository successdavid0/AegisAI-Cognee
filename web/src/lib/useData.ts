"use client";
import { useEffect, useState } from "react";
import type { ApiResult } from "./types";

interface State<T> {
  data: T | null;
  live: boolean;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Loads an API call on mount (and when deps change). Mirrors the
 *  frontend-only contract: it never touches the DB/Cognee directly.
 *
 *  Note: `fetcher` is intentionally excluded from the effect deps — callers
 *  pass an inline closure plus an explicit `deps` array of the values it reads,
 *  which is the stable identity we key re-fetches on. */
export function useData<T>(
  fetcher: () => Promise<ApiResult<T>>,
  deps: unknown[] = [],
): State<T> {
  const [snap, setSnap] = useState<{
    data: T | null;
    live: boolean;
    loading: boolean;
    error: string | null;
  }>({ data: null, live: false, loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    // Entering the loading state when deps change is the purpose of this
    // fetch effect; the cascading-render warning does not apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSnap((s) => ({ ...s, loading: true, error: null }));
    fetcher()
      .then((res) => {
        if (active) setSnap({ data: res.data, live: res.live, loading: false, error: null });
      })
      .catch((e) => {
        if (active) setSnap((s) => ({ ...s, loading: false, error: String(e) }));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...snap, reload: () => setNonce((n) => n + 1) };
}
