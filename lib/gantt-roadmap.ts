import { addMonths, endOfMonth, getYear, startOfMonth } from "date-fns";
import type { IScaleConfig, ITask } from "@svar-ui/react-gantt";
import { registerScaleUnit } from "@svar-ui/react-gantt";
import type { Language, JiraVersion, VersionIssue } from "@/lib/types";
import {
  addJalaliHalfYears,
  addJalaliMonths,
  addJalaliQuarters,
  addJalaliYears,
  formatJalaliHalfYear,
  formatJalaliMonthYear,
  formatJalaliQuarter,
  formatJalaliYear,
  isLeapJalaaliYear,
  isSameJalaliHalfYear,
  isSameJalaliMonth,
  isSameJalaliQuarter,
  isSameJalaliYear,
  jalaaliMonthLength,
  jalaliHalfYearEnd,
  jalaliHalfYearStart,
  jalaliMonthEnd,
  jalaliMonthStart,
  jalaliQuarterEnd,
  jalaliQuarterStart,
  jalaliYearEnd,
  jalaliYearStart,
  toJalaliParts,
} from "@/lib/jalali";
import {
  getVersionStatusLabel,
  groupVersionsByProduct,
  formatVersionProductLabel,
  toDateOnly,
} from "@/lib/roadmap";

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_PAD_DAYS = 14;

export type RoadmapScaleMode = "month" | "quarter" | "halfYear";

export type RoadmapTaskKind = "version" | "issue";

export type RoadmapGanttTask = ITask & {
  kind: RoadmapTaskKind;
  versionId?: string;
  issueKey?: string;
  statusKey?: string;
  css?: string;
  lazy?: boolean;
};

/** Calendar-unit count between dates (end − start). Required when unit is the last scale. */
function diffJalaliMonths(end: Date, start: Date): number {
  const a = toJalaliParts(start);
  const b = toJalaliParts(end);
  return (b.jy - a.jy) * 12 + (b.jm - a.jm);
}

function diffJalaliYears(end: Date, start: Date): number {
  return toJalaliParts(end).jy - toJalaliParts(start).jy;
}

function diffJalaliQuarters(end: Date, start: Date): number {
  return Math.floor(diffJalaliMonths(end, start) / 3);
}

function diffJalaliHalfYears(end: Date, start: Date): number {
  return Math.floor(diffJalaliMonths(end, start) / 6);
}

function daysInRange(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
}

function daysInJalaliMonth(date?: Date): number {
  if (!date) return 30;
  const { jy, jm } = toJalaliParts(date);
  return jalaaliMonthLength(jy, jm);
}

function daysInJalaliYear(date?: Date): number {
  if (!date) return 365;
  const { jy } = toJalaliParts(date);
  return isLeapJalaaliYear(jy) ? 366 : 365;
}

function daysInJalaliQuarter(date?: Date): number {
  if (!date) return 91;
  return daysInRange(jalaliQuarterStart(date), jalaliQuarterEnd(date));
}

function daysInJalaliHalfYear(date?: Date): number {
  if (!date) return 186;
  return daysInRange(jalaliHalfYearStart(date), jalaliHalfYearEnd(date));
}

function gregHalfIndex(d: Date): number {
  return d.getFullYear() * 2 + (d.getMonth() < 6 ? 0 : 1);
}

function daysInGregHalfYear(date?: Date): number {
  if (!date) return 182;
  const start =
    date.getMonth() < 6
      ? new Date(date.getFullYear(), 0, 1)
      : new Date(date.getFullYear(), 6, 1);
  const end =
    date.getMonth() < 6
      ? new Date(date.getFullYear(), 5, 30)
      : new Date(date.getFullYear(), 11, 31);
  return daysInRange(start, end);
}

let scaleUnitsRegistered = false;

export function ensureRoadmapScaleUnits(): void {
  if (scaleUnitsRegistered) return;
  scaleUnitsRegistered = true;

  const halfYearStart = (date: Date) => {
    const d = new Date(date);
    const startMonth = d.getMonth() < 6 ? 0 : 6;
    d.setMonth(startMonth);
    return startOfMonth(d);
  };

  const halfYearEnd = (date: Date) => {
    const d = new Date(date);
    const endMonth = d.getMonth() < 6 ? 5 : 11;
    d.setMonth(endMonth);
    return endOfMonth(d);
  };

  const addHalfYears = (date: Date, amount: number) => {
    const start = halfYearStart(date);
    return addMonths(start, amount * 6);
  };

  const isSameHalfYear = (a: Date, b: Date) => {
    const sa = halfYearStart(a);
    const sb = halfYearStart(b);
    return getYear(sa) === getYear(sb) && sa.getMonth() === sb.getMonth();
  };

  // Last-scale units need diff + smallerCount or SVAR throws `_t[i] is not a function`.
  registerScaleUnit("halfYear", {
    start: halfYearStart,
    end: halfYearEnd,
    isSame: isSameHalfYear,
    add: addHalfYears,
    diff: (end, start) => gregHalfIndex(end) - gregHalfIndex(start),
    smallerCount: {
      month: 6,
      day: daysInGregHalfYear,
      week: (d) => Math.ceil(daysInGregHalfYear(d) / 7),
      hour: (d) => daysInGregHalfYear(d) * 24,
    },
    biggerCount: {
      year: 2,
    },
  });

  // Top-only Jalali year (never last scale in our configs)
  registerScaleUnit("jyear", {
    start: jalaliYearStart,
    end: jalaliYearEnd,
    isSame: isSameJalaliYear,
    add: addJalaliYears,
    diff: diffJalaliYears,
    smallerCount: {
      month: 12,
      quarter: 4,
      day: daysInJalaliYear,
      week: (d) => Math.ceil(daysInJalaliYear(d) / 7),
      hour: (d) => daysInJalaliYear(d) * 24,
    },
  });

  registerScaleUnit("jmonth", {
    start: jalaliMonthStart,
    end: jalaliMonthEnd,
    isSame: isSameJalaliMonth,
    add: addJalaliMonths,
    diff: diffJalaliMonths,
    smallerCount: {
      day: daysInJalaliMonth,
      week: (d) => Math.ceil(daysInJalaliMonth(d) / 7),
      hour: (d) => daysInJalaliMonth(d) * 24,
    },
    biggerCount: {
      year: 12,
      quarter: 3,
    },
  });

  registerScaleUnit("jquarter", {
    start: jalaliQuarterStart,
    end: jalaliQuarterEnd,
    isSame: isSameJalaliQuarter,
    add: addJalaliQuarters,
    diff: diffJalaliQuarters,
    smallerCount: {
      month: 3,
      day: daysInJalaliQuarter,
      week: (d) => Math.ceil(daysInJalaliQuarter(d) / 7),
      hour: (d) => daysInJalaliQuarter(d) * 24,
    },
    biggerCount: {
      year: 4,
    },
  });

  registerScaleUnit("jhalfYear", {
    start: jalaliHalfYearStart,
    end: jalaliHalfYearEnd,
    isSame: isSameJalaliHalfYear,
    add: addJalaliHalfYears,
    diff: diffJalaliHalfYears,
    smallerCount: {
      month: 6,
      day: daysInJalaliHalfYear,
      week: (d) => Math.ceil(daysInJalaliHalfYear(d) / 7),
      hour: (d) => daysInJalaliHalfYear(d) * 24,
    },
    biggerCount: {
      year: 2,
    },
  });
}

export function versionTaskId(versionId: string): string {
  return `version:${versionId}`;
}

export function issueTaskId(key: string): string {
  return `issue:${key}`;
}

export function parseVersionTaskId(id: string | number): string | null {
  const s = String(id);
  return s.startsWith("version:") ? s.slice("version:".length) : null;
}

export function parseIssueTaskId(id: string | number): string | null {
  const s = String(id);
  return s.startsWith("issue:") ? s.slice("issue:".length) : null;
}

function versionDateRange(
  v: Pick<JiraVersion, "startDate" | "releaseDate">
): { start: Date; end: Date } | null {
  const start = v.startDate
    ? toDateOnly(v.startDate)
    : v.releaseDate
      ? new Date(toDateOnly(v.releaseDate).getTime() - 7 * DAY_MS)
      : null;
  const end = v.releaseDate
    ? toDateOnly(v.releaseDate)
    : v.startDate
      ? new Date(toDateOnly(v.startDate).getTime() + 7 * DAY_MS)
      : null;
  if (!start || !end) return null;
  if (end.getTime() < start.getTime()) {
    return { start, end: new Date(start.getTime() + DAY_MS) };
  }
  return { start, end };
}

function statusCss(
  status: ReturnType<typeof getVersionStatusLabel>
): string {
  switch (status) {
    case "released":
      return "rm-bar-released";
    case "overdue":
      return "rm-bar-overdue";
    case "archived":
      return "rm-bar-archived";
    default:
      return "rm-bar-unreleased";
  }
}

export function mapVersionsToGanttTasks(
  versions: JiraVersion[]
): RoadmapGanttTask[] {
  const groups = groupVersionsByProduct(versions);
  const tasks: RoadmapGanttTask[] = [];

  for (const group of groups) {
    const dated = group.versions
      .map((v) => ({ v, range: versionDateRange(v) }))
      .filter((x): x is { v: JiraVersion; range: { start: Date; end: Date } } =>
        Boolean(x.range)
      );

    for (const { v, range } of dated) {
      const status = getVersionStatusLabel(v);
      tasks.push({
        id: versionTaskId(v.id),
        text: formatVersionProductLabel(v.name),
        type: "task",
        start: range.start,
        end: range.end,
        open: false,
        lazy: true,
        progress: status === "released" ? 100 : 0,
        kind: "version",
        versionId: v.id,
        statusKey: status,
        css: statusCss(status),
        details: v.name,
      });
    }
  }

  return tasks;
}

export function mapIssuesToGanttTasks(
  versionId: string,
  issues: VersionIssue[],
  versionRange: { start: Date; end: Date }
): RoadmapGanttTask[] {
  const parent = versionTaskId(versionId);
  return issues.map((issue) => {
    const cat = (issue.statusCategoryKey || "").toLowerCase();
    const progress =
      cat === "done" ? 100 : cat === "indeterminate" ? 40 : 0;
    return {
      id: issueTaskId(issue.key),
      parent,
      text: `${issue.key} · ${issue.summary}`,
      type: "task" as const,
      start: versionRange.start,
      end: versionRange.end,
      progress,
      kind: "issue" as const,
      versionId,
      issueKey: issue.key,
      statusKey: issue.status,
      css: "rm-bar-issue",
      details: issue.assigneeDisplayName || issue.status,
    };
  });
}

export function getVersionRangeFromTasks(
  tasks: RoadmapGanttTask[],
  versionId: string
): { start: Date; end: Date } | null {
  const t = tasks.find((x) => x.id === versionTaskId(versionId));
  if (!t?.start || !t?.end) return null;
  return { start: new Date(t.start), end: new Date(t.end) };
}

export function buildTimelineBounds(
  tasks: RoadmapGanttTask[]
): { start: Date; end: Date } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const t of tasks) {
    if (t.start) min = Math.min(min, t.start.getTime());
    if (t.end) max = Math.max(max, t.end.getTime());
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  const pad = RANGE_PAD_DAYS * DAY_MS;
  return {
    start: new Date(min - pad),
    end: new Date(max + pad),
  };
}

function enQuarter(d: Date): string {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
}

function enHalf(d: Date): string {
  return d.getMonth() < 6
    ? `H1 ${d.getFullYear()}`
    : `H2 ${d.getFullYear()}`;
}

export function getScalesForMode(
  mode: RoadmapScaleMode,
  language: Language
): IScaleConfig[] {
  ensureRoadmapScaleUnits();
  const fa = language === "fa";

  if (mode === "month") {
    if (fa) {
      return [
        {
          unit: "jyear",
          step: 1,
          format: (d) => formatJalaliYear(d),
        },
        {
          unit: "jmonth",
          step: 1,
          format: (d) => formatJalaliMonthYear(d, "fa"),
        },
      ];
    }
    return [
      {
        unit: "year",
        step: 1,
        format: (d) => String(d.getFullYear()),
      },
      {
        unit: "month",
        step: 1,
        format: (d) =>
          d.toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          }),
      },
    ];
  }

  if (mode === "quarter") {
    if (fa) {
      return [
        {
          unit: "jyear",
          step: 1,
          format: (d) => formatJalaliYear(d),
        },
        {
          unit: "jquarter",
          step: 1,
          format: (d) => formatJalaliQuarter(d, "fa"),
        },
      ];
    }
    return [
      {
        unit: "year",
        step: 1,
        format: (d) => String(d.getFullYear()),
      },
      {
        unit: "quarter",
        step: 1,
        format: (d) => enQuarter(d),
      },
    ];
  }

  if (fa) {
    return [
      {
        unit: "jyear",
        step: 1,
        format: (d) => formatJalaliYear(d),
      },
      {
        unit: "jhalfYear",
        step: 1,
        format: (d) => formatJalaliHalfYear(d, "fa"),
      },
    ];
  }

  return [
    {
      unit: "year",
      step: 1,
      format: (d) => String(d.getFullYear()),
    },
    {
      unit: "halfYear",
      step: 1,
      format: (d) => enHalf(d),
    },
  ];
}

export function cellWidthForMode(mode: RoadmapScaleMode): number {
  switch (mode) {
    case "month":
      return 72;
    case "quarter":
      return 140;
    case "halfYear":
      return 180;
  }
}
