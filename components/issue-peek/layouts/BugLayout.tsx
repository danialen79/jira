"use client";

import { AlertTriangleIcon } from "lucide-react";
import { IssuePeekDescription } from "@/components/issue-peek/IssuePeekDescription";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import type { PeekIssue } from "@/lib/issue-peek";

const t = {
  priority: "اولویت",
  repro: "بازتولید / جزئیات",
  related: "مرتبط",
} as const;

type Props = { issue: PeekIssue };

export function BugLayout({ issue }: Props) {
  const { openIssue } = useIssuePeek();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2">
        <AlertTriangleIcon
          className="size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{t.priority}</p>
          <p className="text-sm font-semibold text-destructive">
            {issue.priority || "نیست"}
          </p>
        </div>
      </div>

      {(issue.epicKey || issue.parentKey) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">{t.related}</span>
          {issue.epicKey ? (
            <button
              type="button"
              className="cursor-pointer font-mono text-primary hover:underline"
              translate="no"
              onClick={() => openIssue(issue.epicKey!)}
            >
              {issue.epicKey}
            </button>
          ) : null}
          {issue.parentKey ? (
            <button
              type="button"
              className="cursor-pointer rounded-md border px-1.5 py-1 font-mono text-[11px] hover:bg-muted"
              translate="no"
              onClick={() => openIssue(issue.parentKey!)}
            >
              {issue.parentKey}
            </button>
          ) : null}
        </div>
      )}

      <IssuePeekDescription issue={issue} label={t.repro} />
    </div>
  );
}
