"use client";

import type { ReactNode } from "react";
import type { PeekIssue } from "@/lib/issue-peek";
import { formatJiraSeconds } from "@/lib/issue-peek";
import { lensDisplayLabel } from "@/lib/lens";
import { cn } from "@/lib/utils";

const t = {
  priority: "اولویت",
  component: "کامپوننت",
  parent: "والد",
  lens: "لنز",
  created: "ایجاد",
  updated: "به‌روزرسانی",
  spent: "صرف‌شده",
  remaining: "باقیمانده",
  original: "برآورد اولیه",
  none: "نیست",
} as const;

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return t.none;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export type KvOmit =
  | "priority"
  | "component"
  | "parent"
  | "lens"
  | "created"
  | "updated"
  | "spent"
  | "remaining"
  | "original";

type Row = { label: string; value: ReactNode; id: KvOmit };

type Props = {
  issue: PeekIssue;
  omit?: KvOmit[];
  extra?: { label: string; value: ReactNode }[];
  className?: string;
  onOpenKey?: (key: string) => void;
};

export function IssuePeekKv({
  issue,
  omit = [],
  extra,
  className,
  onOpenKey,
}: Props) {
  const locale = "fa-IR";
  const skip = new Set(omit);

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

  const rows: Row[] = [];

  if (!skip.has("priority")) {
    rows.push({
      id: "priority",
      label: t.priority,
      value: issue.priority || t.none,
    });
  }
  if (!skip.has("component")) {
    rows.push({
      id: "component",
      label: t.component,
      value:
        issue.components?.filter(Boolean).join(", ") ||
        issue.component ||
        t.none,
    });
  }
  if (!skip.has("parent") && issue.parentKey) {
    rows.push({
      id: "parent",
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
  if (!skip.has("lens") && issue.selectedLens) {
    rows.push({
      id: "lens",
      label: t.lens,
      value: lensDisplayLabel(issue.selectedLens),
    });
  }
  if (!skip.has("created")) {
    rows.push({
      id: "created",
      label: t.created,
      value: formatDate(issue.created, locale),
    });
  }
  if (!skip.has("updated")) {
    rows.push({
      id: "updated",
      label: t.updated,
      value: formatDate(issue.updated, locale),
    });
  }
  if (!skip.has("spent")) {
    rows.push({
      id: "spent",
      label: t.spent,
      value: formatJiraSeconds(issue.timespent),
    });
  }
  if (!skip.has("remaining")) {
    rows.push({
      id: "remaining",
      label: t.remaining,
      value: formatJiraSeconds(issue.timeestimate),
    });
  }
  if (!skip.has("original")) {
    rows.push({
      id: "original",
      label: t.original,
      value: formatJiraSeconds(issue.timeoriginalestimate),
    });
  }

  return (
    <dl
      className={cn(
        "grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs",
        className
      )}
      dir="rtl"
    >
      {rows.map((row) => (
        <div key={row.id} className="contents">
          <dt className="text-muted-foreground whitespace-nowrap">{row.label}</dt>
          <dd className="min-w-0 break-words text-foreground">{row.value}</dd>
        </div>
      ))}
      {extra?.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground whitespace-nowrap">{row.label}</dt>
          <dd className="min-w-0 break-words text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
