"use client";

import { useEffect, useState } from "react";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { IssuePeekDescription } from "@/components/issue-peek/IssuePeekDescription";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { lensDisplayLabel } from "@/lib/lens";
import type { PeekIssue } from "@/lib/issue-peek";
import type { OpsIssue } from "@/lib/issue-ops/types";

const t = {
    description: "توضیحات",
    subtasks: "ساب‌تسک‌ها",
    emptySubs: "ساب‌تسکی نیست.",
    loadFail: "بارگذاری ساب‌تسک‌ها نشد.",
    lens: "لنز",
  } as const;

type Props = { issue: PeekIssue };

export function StoryLayout({ issue }: Props) {
  const { openIssue } = useIssuePeek();
  const [subs, setSubs] = useState<OpsIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/jira/issues/subtasks?parentKey=${encodeURIComponent(issue.key)}`
        );
        const data = await res.json();
        if (cancelled) return;
        setSubs(Array.isArray(data.issues) ? data.issues : []);
      } catch {
        if (!cancelled) setSubs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issue.key]);

  return (
    <div className="flex flex-col gap-3">
      {issue.selectedLens ? (
        <Badge variant="outline" className="w-fit">
          {t.lens}: {lensDisplayLabel(issue.selectedLens)}
        </Badge>
      ) : null}

      <IssuePeekDescription issue={issue} label={t.description} />

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium">{t.subtasks}</p>
        {loading ? (
          <Skeleton className="h-8 w-full" />
        ) : subs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.emptySubs}</p>
        ) : (
          <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto overscroll-contain">
            {subs.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-start hover:bg-muted/50"
                  onClick={() => openIssue(s.key)}
                >
                  <span
                    className="font-mono text-[11px] text-primary"
                    translate="no"
                  >
                    {s.key}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px]">
                    {s.summary}
                  </span>
                  <IssueStatusBadge
                    status={s.status}
                    statusCategoryKey={s.statusCategoryKey}
                    className="text-[10px]"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
