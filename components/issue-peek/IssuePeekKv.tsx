"use client";

import type { ReactNode } from "react";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import type { PeekIssue } from "@/lib/issue-peek";
import { formatJiraSeconds } from "@/lib/issue-peek";
import { lensDisplayLabel } from "@/lib/lens";
import { cn } from "@/lib/utils";

const labels = {
  en: {
    assignee: "Assignee",
    priority: "Priority",
    component: "Component",
    sprint: "Sprint",
    fixVersion: "Fix version",
    epic: "Epic",
    parent: "Parent",
    lens: "Lens",
    created: "Created",
    updated: "Updated",
    spent: "Time spent",
    remaining: "Remaining",
    original: "Original est.",
    unassigned: "Unassigned",
    none: "—",
  },
  fa: {
    assignee: "مسئول",
    priority: "اولویت",
    component: "کامپوننت",
    sprint: "اسپرینت",
    fixVersion: "ورژن",
    epic: "اپیک",
    parent: "والد",
    lens: "لنز",
    created: "ایجاد",
    updated: "به‌روزرسانی",
    spent: "صرف‌شده",
    remaining: "باقیمانده",
    original: "برآورد اولیه",
    unassigned: "بدون مسئول",
    none: "—",
  },
} as const;

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Row = { label: string; value: ReactNode };

type Props = {
  issue: PeekIssue;
  extra?: Row[];
  className?: string;
  onOpenKey?: (key: string) => void;
};

export function IssuePeekKv({ issue, extra, className, onOpenKey }: Props) {
  const { language, isRtl, jiraSprints } = useJiraApp();
  const t = labels[language];
  const locale = language === "fa" ? "fa-IR" : "en-US";

  const sprintLabel =
    issue.sprintName ||
    jiraSprints.find((s) => String(s.id) === issue.selectedSprint)?.name ||
    issue.selectedSprint ||
    t.none;

  const keyLink = (key: string) =>
    onOpenKey ? (
      <button
        type="button"
        className="cursor-pointer font-mono text-primary hover:underline"
        translate="no"
        onClick={() => onOpenKey(key)}
      >
        {key}
      </button>
    ) : (
      <span className="font-mono" translate="no">
        {key}
      </span>
    );

  const rows: Row[] = [
    {
      label: t.assignee,
      value: issue.assigneeDisplayName || issue.assignee || t.unassigned,
    },
    { label: t.priority, value: issue.priority || t.none },
    {
      label: t.component,
      value:
        issue.components?.filter(Boolean).join(", ") ||
        issue.component ||
        t.none,
    },
    { label: t.sprint, value: sprintLabel },
    {
      label: t.fixVersion,
      value: issue.fixVersionNames?.length
        ? issue.fixVersionNames.join(", ")
        : t.none,
    },
  ];

  if (issue.epicKey) {
    rows.push({ label: t.epic, value: keyLink(issue.epicKey) });
  }
  if (issue.parentKey) {
    rows.push({
      label: t.parent,
      value: (
        <span className="inline-flex flex-col gap-0.5">
          {keyLink(issue.parentKey)}
          {issue.parentSummary ? (
            <span className="text-[11px] text-muted-foreground line-clamp-1">
              {issue.parentSummary}
            </span>
          ) : null}
        </span>
      ),
    });
  }
  if (issue.selectedLens) {
    rows.push({
      label: t.lens,
      value: lensDisplayLabel(issue.selectedLens, language),
    });
  }

  rows.push(
    { label: t.created, value: formatDate(issue.created, locale) },
    { label: t.updated, value: formatDate(issue.updated, locale) },
    { label: t.spent, value: formatJiraSeconds(issue.timespent) },
    { label: t.remaining, value: formatJiraSeconds(issue.timeestimate) },
    {
      label: t.original,
      value: formatJiraSeconds(issue.timeoriginalestimate),
    }
  );

  if (extra?.length) rows.push(...extra);

  return (
    <dl
      className={cn("grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs", className)}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground whitespace-nowrap">{row.label}</dt>
          <dd className="min-w-0 break-words text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
