import type { IssueLens } from "@/lib/lens";
import { issueOwnsFixVersion } from "@/lib/fix-version-policy";
import { normalizeIssueTypeName } from "@/lib/issue-type-badge";

export const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/i;
export const RECENT_KEYS_STORAGE = "issue-peek-recent";
export const COLLAPSED_STORAGE = "issue-peek-collapsed";
export const MAX_RECENT_KEYS = 12;
export const MAX_NAV_STACK = 8;
export const DOCK_WIDTH_PX = 400;
export const DOCK_RAIL_PX = 44;

/** Peek can set Fix Version on Epic or orphan Story/Bug. */
export function peekCanSetFixVersion(issue: {
  issuetype: string;
  epicKey?: string;
}): boolean {
  return issueOwnsFixVersion(issue.issuetype, Boolean(issue.epicKey));
}

/** Peek can move Story / Bug / Task between sprints. */
export function peekCanSetSprint(issuetype: string): boolean {
  const t = normalizeIssueTypeName(issuetype);
  return t === "story" || t === "bug" || t === "task";
}

export function pushNavStack(
  stack: string[],
  key: string,
  opts?: { replace?: boolean }
): string[] {
  const k = normalizeIssueKey(key);
  if (!isValidIssueKey(k)) return stack;
  if (opts?.replace) return [k];
  const idx = stack.findIndex((x) => x === k);
  if (idx >= 0) return stack.slice(0, idx + 1);
  return [...stack, k].slice(-MAX_NAV_STACK);
}

export type PeekIssue = {
  key: string;
  summary: string;
  description: string;
  issuetype: string;
  priority: string;
  component: string;
  components: string[];
  assignee: string;
  assigneeDisplayName: string;
  status: string;
  statusCategoryKey?: string;
  labels: string[];
  selectedLens?: IssueLens;
  epicKey?: string;
  parentKey?: string;
  parentSummary?: string;
  selectedRelease?: string;
  selectedSprint?: string;
  sprintName?: string;
  fixVersionIds: string[];
  fixVersionNames: string[];
  created?: string;
  updated?: string;
  timespent?: number;
  timeestimate?: number;
  timeoriginalestimate?: number;
};

export function normalizeIssueKey(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isValidIssueKey(raw: string): boolean {
  return ISSUE_KEY_RE.test(normalizeIssueKey(raw));
}

export function readRecentKeys(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEYS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((k) => normalizeIssueKey(String(k || "")))
      .filter(isValidIssueKey)
      .slice(0, MAX_RECENT_KEYS);
  } catch {
    return [];
  }
}

export function writeRecentKeys(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      RECENT_KEYS_STORAGE,
      JSON.stringify(keys.slice(0, MAX_RECENT_KEYS))
    );
  } catch {
    /* ignore */
  }
}

export function pushRecentKey(key: string, existing: string[]): string[] {
  const k = normalizeIssueKey(key);
  if (!isValidIssueKey(k)) return existing;
  const next = [k, ...existing.filter((x) => x !== k)].slice(
    0,
    MAX_RECENT_KEYS
  );
  writeRecentKeys(next);
  return next;
}

export function readCollapsedPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(COLLAPSED_STORAGE) === "1";
  } catch {
    return false;
  }
}

export function writeCollapsedPref(collapsed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COLLAPSED_STORAGE, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function formatJiraSeconds(seconds?: number): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}
