"use client";

import { ClockIcon } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { formatJiraSeconds, type PeekIssue } from "@/lib/issue-peek";

const copy = {
  en: {
    time: "Time tracking",
    spent: "Spent",
    remaining: "Remaining",
    original: "Original",
    description: "Description",
  },
  fa: {
    time: "زمان",
    spent: "صرف‌شده",
    remaining: "باقیمانده",
    original: "اولیه",
    description: "توضیحات",
  },
} as const;

type Props = { issue: PeekIssue };

export function TaskLayout({ issue }: Props) {
  const { language } = useJiraApp();
  const t = copy[language];

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-border/70 bg-muted/20 p-2.5">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium">
          <ClockIcon className="size-3.5" aria-hidden />
          {t.time}
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">{t.spent}</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatJiraSeconds(issue.timespent)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">{t.remaining}</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatJiraSeconds(issue.timeestimate)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">{t.original}</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatJiraSeconds(issue.timeoriginalestimate)}
            </p>
          </div>
        </div>
      </div>

      {issue.description ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">{t.description}</p>
          <div className="max-h-40 overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
            <MarkdownPreview text={issue.description} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
