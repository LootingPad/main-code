"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LoadState<T> = {
  data: T;
  error: string | null;
  loading: boolean;
  reload: () => void;
};

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

/**
 * Client fetch with optional polling.
 * `loading` is only true for the initial load of the current deps key (not polls).
 * Polls that return [] keep the last non-empty data (flaky upstream).
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options?: { initial: T; pollMs?: number; enabled?: boolean },
): LoadState<T> {
  const initial = options?.initial as T;
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(options?.enabled ?? true));
  const [tick, setTick] = useState(0);
  const enabled = options?.enabled ?? true;
  const pollMs = options?.pollMs;
  const loaderRef = useRef(loader);
  const dataRef = useRef(data);
  loaderRef.current = loader;
  dataRef.current = data;

  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let alive = true;
    let initialDone = false;
    let isFirstForDeps = true;
    setLoading(true);

    const run = async () => {
      const first = isFirstForDeps;
      isFirstForDeps = false;
      try {
        const next = await loaderRef.current();
        if (!alive) return;
        const prev = dataRef.current;
        // Polls only: keep last rows if upstream briefly returns [].
        if (!first && isEmptyArray(next) && !isEmptyArray(prev)) {
          setError(null);
          return;
        }
        setData(next);
        dataRef.current = next;
        setError(null);
      } catch (err) {
        if (!alive) return;
        if (isEmptyArray(dataRef.current)) {
          setError(err instanceof Error ? err.message : "Request failed");
        }
      } finally {
        if (!alive) return;
        if (!initialDone) {
          initialDone = true;
          setLoading(false);
        }
      }
    };

    void run();

    if (!pollMs || pollMs <= 0) {
      return () => {
        alive = false;
      };
    }

    const id = window.setInterval(() => {
      if (!alive || document.visibilityState === "hidden") return;
      void run();
    }, pollMs);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps passed explicitly
  }, [enabled, pollMs, tick, ...deps]);

  return { data, error, loading, reload };
}
