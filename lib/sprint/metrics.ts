import type { SprintIssue } from "@/lib/types";
import { secondsToHours, statusBucket } from "@/lib/sprint/map";

export type SprintHealth = {
  todo: number;
  inProgress: number;
  done: number;
  total: number;
  percentDone: number;
  hoursTodo: number;
  hoursInProgress: number;
  hoursDone: number;
  hoursRemaining: number;
  hoursOriginal: number;
  daysLeft: number | null;
};

export type BurndownPoint = {
  date: string;
  remaining: number;
  ideal: number;
};

export type VelocityBar = {
  sprintId: number;
  name: string;
  completed: number;
  committed: number;
  hoursCompleted: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeHealth(
  issues: SprintIssue[],
  endDate?: string | null
): SprintHealth {
  let todo = 0;
  let inProgress = 0;
  let done = 0;
  let hoursTodo = 0;
  let hoursInProgress = 0;
  let hoursDone = 0;
  let hoursOriginal = 0;

  for (const issue of issues) {
    const bucket = statusBucket(issue.statusCategoryKey);
    const remaining = secondsToHours(issue.timeestimate || 0);
    const original = secondsToHours(issue.timeoriginalestimate || 0);
    hoursOriginal += original;
    if (bucket === "done") {
      done += 1;
      hoursDone += secondsToHours(issue.timespent || original || 0);
    } else if (bucket === "inProgress") {
      inProgress += 1;
      hoursInProgress += remaining || original;
    } else {
      todo += 1;
      hoursTodo += remaining || original;
    }
  }

  const total = todo + inProgress + done;
  const percentDone = total === 0 ? 0 : Math.round((done / total) * 100);

  let daysLeft: number | null = null;
  if (endDate) {
    const end = new Date(endDate);
    if (!Number.isNaN(end.getTime())) {
      const ms = end.getTime() - Date.now();
      daysLeft = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
    }
  }

  return {
    todo,
    inProgress,
    done,
    total,
    percentDone,
    hoursTodo: round1(hoursTodo),
    hoursInProgress: round1(hoursInProgress),
    hoursDone: round1(hoursDone),
    hoursRemaining: round1(hoursTodo + hoursInProgress),
    hoursOriginal: round1(hoursOriginal),
    daysLeft,
  };
}

export function buildIdealBurndown(
  startDate: string | undefined,
  endDate: string | undefined,
  startRemaining: number
): BurndownPoint[] {
  if (!startDate || !endDate || startRemaining < 0) return [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end <= start) return [];

  const days = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  );
  const points: BurndownPoint[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ideal = startRemaining * (1 - i / days);
    points.push({
      date: d.toISOString().slice(0, 10),
      remaining: round1(ideal),
      ideal: round1(ideal),
    });
  }
  return points;
}

/** Ideal line + today's remaining when Greenhopper history is unavailable. */
export function synthesizeBurndown(
  startDate: string | undefined,
  endDate: string | undefined,
  committedCount: number,
  remainingCount: number
): { points: BurndownPoint[]; limited: boolean } {
  const ideal = buildIdealBurndown(startDate, endDate, committedCount);
  if (ideal.length === 0) {
    return { points: [], limited: true };
  }
  const today = new Date().toISOString().slice(0, 10);
  const points = ideal.map((p) => ({
    date: p.date,
    ideal: p.ideal,
    remaining: p.date <= today ? remainingCount : p.ideal,
  }));
  return { points, limited: true };
}

export function parseGreenhopperSprintReport(data: any): {
  completedKeys: string[];
  notCompletedKeys: string[];
  puntedKeys: string[];
  addedKeys: string[];
} {
  const completed =
    (data?.contents?.completedIssues as Array<{ key?: string }>) || [];
  const notCompleted =
    (data?.contents?.issuesNotCompletedInCurrentSprint as Array<{
      key?: string;
    }>) ||
    (data?.contents?.incompleteIssues as Array<{ key?: string }>) ||
    [];
  const punted =
    (data?.contents?.puntedIssues as Array<{ key?: string }>) || [];

  let addedKeys: string[] = [];
  const addedMap = data?.contents?.issueKeysAddedDuringSprint;
  if (addedMap && typeof addedMap === "object") {
    addedKeys = Object.keys(addedMap);
  } else if (Array.isArray(data?.contents?.issuesAdded)) {
    addedKeys = (data.contents.issuesAdded as Array<{ key?: string }>)
      .map((i) => i.key || "")
      .filter(Boolean);
  }

  return {
    completedKeys: completed.map((i) => i.key || "").filter(Boolean),
    notCompletedKeys: notCompleted.map((i) => i.key || "").filter(Boolean),
    puntedKeys: punted.map((i) => i.key || "").filter(Boolean),
    addedKeys,
  };
}

/** Parse Greenhopper estimate statistic burndown changes into points. */
export function parseGreenhopperBurndown(
  data: any,
  startDate?: string,
  endDate?: string,
  startRemaining?: number
): BurndownPoint[] | null {
  const changes = data?.changes;
  if (!changes || typeof changes !== "object") return null;

  const entries = Object.entries(changes as Record<string, unknown[]>)
    .map(([ts, events]) => ({
      ts: Number(ts),
      events: Array.isArray(events) ? events : [],
    }))
    .filter((e) => Number.isFinite(e.ts))
    .sort((a, b) => a.ts - b.ts);

  if (entries.length === 0) return null;

  let remaining = startRemaining ?? 0;
  // Some GH payloads include initial estimate in rateData
  if (typeof data?.startValue === "number") {
    remaining = data.startValue;
  }

  const byDay = new Map<string, number>();
  for (const entry of entries) {
    for (const ev of entry.events) {
      const delta =
        typeof (ev as any)?.statC?.newValue === "number"
          ? (ev as any).statC.newValue - ((ev as any).statC?.oldValue ?? 0)
          : typeof (ev as any)?.added === "boolean"
            ? (ev as any).added
              ? 1
              : -1
            : 0;
      // Prefer explicit remaining if present
      if (typeof (ev as any)?.statC?.newValue === "number" && (ev as any)?.column) {
        // ignore column-only
      }
      if (typeof (ev as any)?.statC?.newValue === "number" && !(ev as any)?.added) {
        // time-tracking style: treat as absolute remaining when key is estimate
      }
      void delta;
    }
    // Fallback: count-based — track issue add/remove/done via `key` events
    for (const ev of entry.events) {
      if ((ev as any)?.added === true) remaining += 1;
      else if ((ev as any)?.added === false) remaining -= 1;
      else if ((ev as any)?.column?.done === true) remaining = Math.max(0, remaining - 1);
      else if ((ev as any)?.column?.notDone === true) remaining += 1;
    }
    const date = new Date(entry.ts).toISOString().slice(0, 10);
    byDay.set(date, Math.max(0, remaining));
  }

  const ideal = buildIdealBurndown(
    startDate,
    endDate,
    startRemaining ?? remaining
  );
  if (ideal.length === 0) {
    return Array.from(byDay.entries()).map(([date, rem]) => ({
      date,
      remaining: rem,
      ideal: rem,
    }));
  }

  let last = startRemaining ?? 0;
  return ideal.map((p) => {
    if (byDay.has(p.date)) last = byDay.get(p.date)!;
    return { date: p.date, ideal: p.ideal, remaining: last };
  });
}
