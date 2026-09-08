"use client";

import { ExternalLink } from "lucide-react";
import type { Language, VersionIssue } from "@/lib/types";
import { lensDisplayLabel } from "@/lib/lens";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Layers } from "lucide-react";

type Props = {
  issues: VersionIssue[];
  total?: number;
  jiraUrl: string;
  language: Language;
  compact?: boolean;
  className?: string;
};

const copy = {
  en: {
    showing: (n: number, total: number) => `Showing ${n} of ${total}`,
    empty: "No issues",
    emptyHint: "Assign Fix Version on issues in Jira.",
    unassigned: "Unassigned",
  },
  fa: {
    showing: (n: number, total: number) => `نمایش ${n} از ${total}`,
    empty: "ایشویی نیست",
    emptyHint: "Fix Version را روی ایشوها تنظیم کنید.",
    unassigned: "بدون مسئول",
  },
} as const;

export default function VersionIssueList({
  issues,
  total,
  jiraUrl,
  language,
  compact = false,
  className,
}: Props) {
  const t = copy[language];
  const base = jiraUrl.replace(/\/+$/, "");
  const shownTotal = total ?? issues.length;

  if (issues.length === 0) {
    return (
      <Empty className={compact ? "border py-6" : "border py-8"}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers />
          </EmptyMedia>
          <EmptyTitle>{t.empty}</EmptyTitle>
          {!compact && <EmptyDescription>{t.emptyHint}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className={className}>
      {shownTotal > issues.length && (
        <p className="mb-2 text-xs text-muted-foreground">
          {t.showing(issues.length, shownTotal)}
        </p>
      )}
      <ScrollArea className={compact ? "h-48 pe-2" : "h-[min(60vh,28rem)] pe-3"}>
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li
              key={issue.key}
              className={
                compact
                  ? "flex flex-col gap-0.5 rounded-md border px-2.5 py-1.5"
                  : "flex flex-col gap-1 rounded-lg border p-3"
              }
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <a
                  href={`${base}/browse/${issue.key}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                  translate="no"
                  onClick={(e) => e.stopPropagation()}
                >
                  {issue.key}
                  {compact ? null : (
                    <ExternalLink
                      className="size-3 opacity-60"
                      aria-hidden="true"
                    />
                  )}
                </a>
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge variant="secondary">{issue.issuetype}</Badge>
                  <Badge variant="outline">{issue.status}</Badge>
                  {issue.lens && (
                    <Badge variant="outline">
                      {lensDisplayLabel(issue.lens, language)}
                    </Badge>
                  )}
                </div>
              </div>
              <p
                className={
                  compact
                    ? "truncate text-xs leading-snug text-foreground"
                    : "text-sm leading-snug"
                }
              >
                {issue.summary}
              </p>
              {!compact && (
                <p className="text-xs text-muted-foreground">
                  {issue.assigneeDisplayName || t.unassigned}
                </p>
              )}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
