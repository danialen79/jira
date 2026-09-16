import type { IssueLens } from "@/lib/lens";
import { issueOwnsFixVersion } from "@/lib/fix-version-policy";
import { normalizeIssueTypeName } from "@/lib/issue-type-badge";

export const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/i;
export const RECENT_KEYS_STORAGE = "issue-peek-recent";
export const COLLAPSED_STORAGE = "issue-peek-collapsed";
export const DOCK_WIDTH_STORAGE = "issue-peek-dock-width";
export const MAX_RECENT_KEYS = 12;
export const MAX_NAV_STACK = 8;
export const DEFAULT_DOCK_WIDTH_PX = 400;
/** @deprecated Use DEFAULT_DOCK_WIDTH_PX */
export const DOCK_WIDTH_PX = DEFAULT_DOCK_WIDTH_PX;
export const MIN_DOCK_WIDTH_PX = 320;
export const MAX_DOCK_WIDTH_PX = 640;
export const DOCK_RAIL_PX = 44;
export const OVERLAY_BREAKPOINT_PX = 1100;

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

/** Peek can set Epic Link on Story / Bug. */
export function peekCanSetEpicLink(issuetype: string): boolean {
  const t = normalizeIssueTypeName(issuetype);
  return t === "story" || t === "bug";
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

export type RecentIssue = {
  key: string;
  summary: string;
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

/**
 * Accept bare keys, pasted browse URLs, or selectedIssue= query params.
 */
export function parseIssueKeyInput(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";

  const browse = text.match(/\/browse\/([A-Za-z][A-Za-z0-9]+-\d+)/i);
  if (browse?.[1]) return normalizeIssueKey(browse[1]);

  const selected = text.match(/[?&#]selectedIssue=([A-Za-z][A-Za-z0-9]+-\d+)/i);
  if (selected?.[1]) return normalizeIssueKey(selected[1]);

  const embedded = text.match(/\b([A-Za-z][A-Za-z0-9]+-\d+)\b/);
  if (embedded?.[1] && /https?:\/\//i.test(text)) {
    return normalizeIssueKey(embedded[1]);
  }

  return normalizeIssueKey(text);
}

export function clampDockWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_DOCK_WIDTH_PX;
  return Math.min(
    MAX_DOCK_WIDTH_PX,
    Math.max(MIN_DOCK_WIDTH_PX, Math.round(width))
  );
}

export function readDockWidth(): number {
  if (typeof window === "undefined") return DEFAULT_DOCK_WIDTH_PX;
  try {
    const raw = localStorage.getItem(DOCK_WIDTH_STORAGE);
    if (!raw) return DEFAULT_DOCK_WIDTH_PX;
    return clampDockWidth(Number(raw));
  } catch {
    return DEFAULT_DOCK_WIDTH_PX;
  }
}

export function writeDockWidth(width: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DOCK_WIDTH_STORAGE, String(clampDockWidth(width)));
  } catch {
    /* ignore */
  }
}

function normalizeRecentEntry(item: unknown): RecentIssue | null {
  if (typeof item === "string") {
    const key = normalizeIssueKey(item);
    if (!isValidIssueKey(key)) return null;
    return { key, summary: "" };
  }
  if (!item || typeof item !== "object") return null;
  const rec = item as { key?: unknown; summary?: unknown };
  const key = normalizeIssueKey(String(rec.key || ""));
  if (!isValidIssueKey(key)) return null;
  return {
    key,
    summary: String(rec.summary || "").trim(),
  };
}

export function readRecentIssues(): RecentIssue[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEYS_STORAGE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecentIssue[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      const entry = normalizeRecentEntry(item);
      if (!entry || seen.has(entry.key)) continue;
      seen.add(entry.key);
      out.push(entry);
      if (out.length >= MAX_RECENT_KEYS) break;
    }
    return out;
  } catch {
    return [];
  }
}

/** @deprecated Prefer readRecentIssues */
export function readRecentKeys(): string[] {
  return readRecentIssues().map((r) => r.key);
}

export function writeRecentIssues(items: RecentIssue[]): void {
  if (typeof window === "undefined") return;
  try {
    const cleaned = items
      .map((item) => normalizeRecentEntry(item))
      .filter((x): x is RecentIssue => Boolean(x))
      .slice(0, MAX_RECENT_KEYS);
    localStorage.setItem(RECENT_KEYS_STORAGE, JSON.stringify(cleaned));
  } catch {
    /* ignore */
  }
}

export function pushRecentIssue(
  entry: { key: string; summary?: string },
  existing: RecentIssue[]
): RecentIssue[] {
  const key = normalizeIssueKey(entry.key);
  if (!isValidIssueKey(key)) return existing;
  const summary = String(entry.summary || "").trim();
  const prev = existing.find((x) => x.key === key);
  const next: RecentIssue[] = [
    { key, summary: summary || prev?.summary || "" },
    ...existing.filter((x) => x.key !== key),
  ].slice(0, MAX_RECENT_KEYS);
  writeRecentIssues(next);
  return next;
}

/** @deprecated Prefer pushRecentIssue */
export function pushRecentKey(key: string, existing: string[]): string[] {
  const asRecent = existing.map((k) => ({ key: k, summary: "" }));
  return pushRecentIssue({ key }, asRecent).map((r) => r.key);
}

export function writeRecentKeys(keys: string[]): void {
  writeRecentIssues(keys.map((key) => ({ key, summary: "" })));
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
