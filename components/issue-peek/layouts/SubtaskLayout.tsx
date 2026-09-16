"use client";

import { IssuePeekDescription } from "@/components/issue-peek/IssuePeekDescription";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { formatJiraSeconds, type PeekIssue } from "@/lib/issue-peek";

const copy = {
  en: {
    spent: "Spent",
    remaining: "Remaining",
    description: "Description",
  },
  fa: {
    spent: "صرف‌شده",
    remaining: "باقیمانده",
    description: "توضیحات",
  },
} as const;

type Props = { issue: PeekIssue };

export function SubtaskLayout({ issue }: Props) {
  const { language } = useJiraApp();
  const t = copy[language];

  return (
    <div className="flex flex-col gap-3">
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

      <IssuePeekDescription issue={issue} label={t.description} />
    </div>
  );
}
