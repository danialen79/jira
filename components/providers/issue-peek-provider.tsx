"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type PeekIssue,
  type RecentIssue,
  isValidIssueKey,
  parseIssueKeyInput,
  pushNavStack,
  pushRecentIssue,
  readCollapsedPref,
  readRecentIssues,
  writeCollapsedPref,
} from "@/lib/issue-peek";

export type OpenIssueOptions = {
  /** Reset stack to this key only (search / URL / clear). Default: push or truncate. */
  replace?: boolean;
};

type IssuePeekContextValue = {
  issueKey: string | null;
  issue: PeekIssue | null;
  loading: boolean;
  error: string | null;
  collapsed: boolean;
  recentIssues: RecentIssue[];
  /** @deprecated Prefer recentIssues */
  recentKeys: string[];
  navStack: string[];
  openIssue: (key: string, opts?: OpenIssueOptions) => void;
  clearIssue: () => void;
  setCollapsed: (collapsed: boolean) => void;
  expandAndFocusSearch: () => void;
  refresh: () => Promise<void>;
  patchIssue: (patch: Partial<PeekIssue>) => void;
  rewriteOpen: boolean;
  setRewriteOpen: (open: boolean) => void;
};

const IssuePeekContext = createContext<IssuePeekContextValue | null>(null);

const ERR = {
  invalid: "کلید ایشو نامعتبر است.",
  loadFail: "بارگذاری ایشو نشد.",
} as const;

export function useIssuePeek() {
  const ctx = useContext(IssuePeekContext);
  if (!ctx) {
    throw new Error("useIssuePeek must be used within IssuePeekProvider");
  }
  return ctx;
}

/** Soft hook when peek may be unavailable. */
export function useIssuePeekOptional() {
  return useContext(IssuePeekContext);
}

async function fetchPeekIssue(key: string): Promise<PeekIssue> {
  const res = await fetch("/api/jira/fetch-issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issueKey: key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.issue) {
    throw new Error(data.error || ERR.loadFail);
  }
  return data.issue as PeekIssue;
}

function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  const tag = node?.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    Boolean(node?.isContentEditable)
  );
}

function isEscBlocked(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      "[data-slot='dialog-content'][data-open], [data-slot='sheet-content'][data-open], [data-slot='alert-dialog-content'][data-open], [data-slot='popover-content'][data-open], [data-slot='dropdown-menu-content'][data-open], [data-slot='select-content'][data-open]"
    )
  );
}

export function IssuePeekProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [issueKey, setIssueKey] = useState<string | null>(null);
  const [issue, setIssue] = useState<PeekIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsedState] = useState(false);
  const [recentIssues, setRecentIssues] = useState<RecentIssue[]>([]);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const loadGen = useRef(0);
  const urlSyncSkip = useRef(false);

  useEffect(() => {
    setCollapsedState(readCollapsedPref());
    setRecentIssues(readRecentIssues());
    setHydrated(true);
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    writeCollapsedPref(next);
  }, []);

  const syncUrl = useCallback(
    (key: string | null) => {
      const current = searchParams.get("issue");
      if ((key || null) === (current || null)) return;
      const next = new URLSearchParams(searchParams.toString());
      if (key) next.set("issue", key);
      else next.delete("issue");
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      urlSyncSkip.current = true;
      router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const loadIssue = useCallback(async (rawKey: string) => {
    const key = parseIssueKeyInput(rawKey);
    if (!isValidIssueKey(key)) {
      setError(ERR.invalid);
      return;
    }
    const gen = ++loadGen.current;
    setIssueKey(key);
    setLoading(true);
    setError(null);
    try {
      const loaded = await fetchPeekIssue(key);
      if (gen !== loadGen.current) return;
      setIssue(loaded);
      setRecentIssues((prev) =>
        pushRecentIssue({ key, summary: loaded.summary }, prev)
      );
    } catch (e) {
      if (gen !== loadGen.current) return;
      setIssue(null);
      setError(e instanceof Error ? e.message : ERR.loadFail);
    } finally {
      if (gen === loadGen.current) setLoading(false);
    }
  }, []);

  const openIssue = useCallback(
    (rawKey: string, opts?: OpenIssueOptions) => {
      const key = parseIssueKeyInput(rawKey);
      if (!isValidIssueKey(key)) {
        setError(ERR.invalid);
        setCollapsed(false);
        return;
      }
      setCollapsed(false);
      setNavStack((prev) => pushNavStack(prev, key, { replace: opts?.replace }));
      syncUrl(key);
      void loadIssue(key);
    },
    [loadIssue, setCollapsed, syncUrl]
  );

  const clearIssue = useCallback(() => {
    loadGen.current += 1;
    setIssueKey(null);
    setIssue(null);
    setError(null);
    setLoading(false);
    setNavStack([]);
    setRewriteOpen(false);
    syncUrl(null);
  }, [syncUrl]);

  const refresh = useCallback(async () => {
    if (!issueKey) return;
    await loadIssue(issueKey);
  }, [issueKey, loadIssue]);

  const patchIssue = useCallback((patch: Partial<PeekIssue>) => {
    setIssue((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const expandAndFocusSearch = useCallback(() => {
    setCollapsed(false);
    requestAnimationFrame(() => {
      const el = document.getElementById(
        "issue-peek-search"
      ) as HTMLInputElement | null;
      el?.focus();
      el?.select();
    });
  }, [setCollapsed]);

  useEffect(() => {
    if (!hydrated) return;
    if (urlSyncSkip.current) {
      urlSyncSkip.current = false;
      return;
    }
    const fromUrl = parseIssueKeyInput(searchParams.get("issue") || "");
    if (!fromUrl || !isValidIssueKey(fromUrl)) return;
    if (fromUrl === issueKey) return;
    setCollapsed(false);
    setNavStack((prev) => pushNavStack(prev, fromUrl, { replace: true }));
    void loadIssue(fromUrl);
  }, [hydrated, searchParams, issueKey, loadIssue, setCollapsed]);

  // Keep ?issue= across in-app navigations while a peek issue is active.
  useEffect(() => {
    if (!hydrated || !issueKey) return;
    if (searchParams.get("issue") === issueKey) return;
    syncUrl(issueKey);
  }, [pathname, hydrated, issueKey, searchParams, syncUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.key.toLowerCase() !== "j") return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      expandAndFocusSearch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expandAndFocusSearch]);

  // Esc collapses the panel (issue stays loaded).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (collapsed) return;
      if (rewriteOpen) return;
      if (isTypingTarget(e.target)) return;
      if (isEscBlocked()) return;
      e.preventDefault();
      setCollapsed(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsed, rewriteOpen, setCollapsed]);

  // Alt+← pops nav stack (browser-like), regardless of UI dir.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== "ArrowLeft") return;
      if (isTypingTarget(e.target)) return;
      if (navStack.length < 2) return;
      e.preventDefault();
      const prev = navStack[navStack.length - 2];
      if (prev) openIssue(prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navStack, openIssue]);

  const recentKeys = useMemo(
    () => recentIssues.map((r) => r.key),
    [recentIssues]
  );

  const value = useMemo<IssuePeekContextValue>(
    () => ({
      issueKey,
      issue,
      loading,
      error,
      collapsed,
      recentIssues,
      recentKeys,
      navStack,
      openIssue,
      clearIssue,
      setCollapsed,
      expandAndFocusSearch,
      refresh,
      patchIssue,
      rewriteOpen,
      setRewriteOpen,
    }),
    [
      issueKey,
      issue,
      loading,
      error,
      collapsed,
      recentIssues,
      recentKeys,
      navStack,
      openIssue,
      clearIssue,
      setCollapsed,
      expandAndFocusSearch,
      refresh,
      patchIssue,
      rewriteOpen,
    ]
  );

  return (
    <IssuePeekContext.Provider value={value}>{children}</IssuePeekContext.Provider>
  );
}
