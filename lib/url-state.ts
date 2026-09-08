"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ParamMap = Record<string, string | null | undefined>;

/** Read a query param, or `fallback` when missing/empty. */
export function getSearchParam(
  searchParams: URLSearchParams,
  key: string,
  fallback = ""
): string {
  const value = searchParams.get(key);
  return value == null || value === "" ? fallback : value;
}

/**
 * Keep a set of query params in sync with local state.
 * Writes via `router.replace` (no scroll). Skips no-op updates.
 */
export function useUrlQueryState(
  values: ParamMap,
  defaults: ParamMap = {}
): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastWritten = useRef<string>("");

  const serialized = useMemo(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, raw] of Object.entries(values)) {
      const def = defaults[key] ?? null;
      const value = raw == null || raw === "" ? null : String(raw);
      if (value == null || value === def) {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    return next.toString();
  }, [values, defaults, searchParams]);

  useEffect(() => {
    if (serialized === searchParams.toString()) return;
    if (serialized === lastWritten.current) return;
    lastWritten.current = serialized;
    const href = serialized ? `${pathname}?${serialized}` : pathname;
    router.replace(href, { scroll: false });
  }, [serialized, searchParams, pathname, router]);
}

export function useReplaceQuery(): (patch: ParamMap) => void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (patch: ParamMap) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, raw] of Object.entries(patch)) {
        if (raw == null || raw === "") next.delete(key);
        else next.set(key, String(raw));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );
}
