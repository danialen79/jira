"use client";

import { useCallback, useEffect, useState } from "react";
import type { OpsFilterValues } from "@/lib/issue-ops/types";
import type { OpsIssue } from "@/lib/issue-ops/types";

type SearchResponse = {
  success?: boolean;
  issues?: OpsIssue[];
  total?: number;
  startAt?: number;
  maxResults?: number;
  error?: string;
};

export function useIssueOpsQuery(
  filters: OpsFilterValues,
  startAt: number,
  maxResults: number,
  enabled: boolean
) {
  const [issues, setIssues] = useState<OpsIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIssues([]);
      setTotal(0);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters.backlog === "1") params.set("backlog", "1");
        else params.set("backlog", "0");
        if (filters.type && filters.type !== "ALL")
          params.set("type", filters.type);
        if (filters.status && filters.status !== "ALL")
          params.set("status", filters.status);
        if (filters.version && filters.version !== "ALL")
          params.set("version", filters.version);
        if (filters.q.trim()) params.set("q", filters.q.trim());
        params.set("startAt", String(startAt));
        params.set("maxResults", String(maxResults));

        const res = await fetch(`/api/jira/issues/search?${params}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as SearchResponse;
        if (cancelled) return;
        if (!res.ok || !data.success) {
          setError(data.error || "Failed to load issues.");
          setIssues([]);
          setTotal(0);
          return;
        }
        setIssues(data.issues || []);
        setTotal(data.total ?? 0);
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError"))
          return;
        setError(e instanceof Error ? e.message : "Failed to load issues.");
        setIssues([]);
        setTotal(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filters, startAt, maxResults, enabled, reloadToken]);

  return { issues, total, loading, error, refresh };
}
