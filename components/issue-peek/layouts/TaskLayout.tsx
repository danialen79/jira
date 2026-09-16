"use client";

import { ClockIcon } from "lucide-react";
import { IssuePeekDescription } from "@/components/issue-peek/IssuePeekDescription";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { formatJiraSeconds, type PeekIssue } from "@/lib/issue-peek";

const t = {
    time: "زمان",
    spent: "صرف‌شده",
    remaining: "باقیمانده",
    original: "اولیه",
    description: "توضیحات",
  } as const;

type Props = { issue: PeekIssue };

export function TaskLayout({ issue }: Props) {
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

      <IssuePeekDescription issue={issue} label={t.description} />
    </div>
  );
}
