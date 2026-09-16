"use client";

import { CornerDownLeftIcon } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { formatJiraSeconds, type PeekIssue } from "@/lib/issue-peek";

const copy = {
  en: {
    parent: "Parent",
    spent: "Spent",
    remaining: "Remaining",
    description: "Description",
    noParent: "No parent linked.",
  },
  fa: {
    parent: "والد",
    spent: "صرف‌شده",
    remaining: "باقیمانده",
    description: "توضیحات",
    noParent: "والدی لینک نشده.",
  },
} as const;

type Props = { issue: PeekIssue };

export function SubtaskLayout({ issue }: Props) {
  const { language } = useJiraApp();
  const t = copy[language];
  const { openIssue } = useIssuePeek();

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 rounded-md border border-sky-500/30 bg-sky-500/5 p-2">
        <p className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <CornerDownLeftIcon className="size-3" aria-hidden />
          {t.parent}
        </p>
        {issue.parentKey ? (
          <button
            type="button"
            className="flex w-full cursor-pointer flex-col gap-0.5 text-start"
            onClick={() => openIssue(issue.parentKey!)}
          >
            <span className="font-mono text-xs text-primary" translate="no">
              {issue.parentKey}
            </span>
            {issue.parentSummary ? (
              <span className="text-xs leading-snug text-pretty">
                {issue.parentSummary}
              </span>
            ) : null}
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">{t.noParent}</p>
        )}
      </div>

      <div className="flex gap-4 text-xs">
        <div>
          <p className="text-muted-foreground">{t.spent}</p>
          <p className="font-medium tabular-nums">
            {formatJiraSeconds(issue.timespent)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">{t.remaining}</p>
          <p className="font-medium tabular-nums">
            {formatJiraSeconds(issue.timeestimate)}
          </p>
        </div>
      </div>

      {issue.description ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">{t.description}</p>
          <div className="max-h-32 overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
            <MarkdownPreview text={issue.description} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
