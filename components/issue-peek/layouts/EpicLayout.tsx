"use client";

import { useEffect, useMemo, useState } from "react";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { resolveIssueStatusTone } from "@/lib/issue-status-badge";
import type { VersionIssue } from "@/lib/types";

const copy = {
  en: {
    children: "Children",
    empty: "No child issues.",
    loadFail: "Could not load children.",
    progress: "Progress",
  },
  fa: {
    children: "فرزندان",
    empty: "فرزندی نیست.",
    loadFail: "بارگذاری فرزندان نشد.",
    progress: "پیشرفت",
  },
} as const;

type Props = { epicKey: string };

export function EpicLayout({ epicKey }: Props) {
  const { language } = useJiraApp();
  const t = copy[language];
  const { openIssue } = useIssuePeek();
  const [children, setChildren] = useState<VersionIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/jira/issues/epic-children?epicKey=${encodeURIComponent(epicKey)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || t.loadFail);
        setChildren(Array.isArray(data.issues) ? data.issues : []);
      } catch (e) {
        if (!cancelled) {
          setChildren([]);
          setError(e instanceof Error ? e.message : t.loadFail);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [epicKey, t.loadFail]);

  const stats = useMemo(() => {
    let todo = 0;
    let inProgress = 0;
    let done = 0;
    for (const c of children) {
      const tone = resolveIssueStatusTone(c.status, c.statusCategoryKey);
      if (tone === "done" || tone === "canceled") done += 1;
      else if (tone === "inProgress") inProgress += 1;
      else todo += 1;
    }
    const total = children.length;
    const percent = total ? Math.round((done / total) * 100) : 0;
    return { todo, inProgress, done, total, percent };
  }, [children]);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-xs text-destructive">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t.progress}</span>
          <span className="tabular-nums">
            {stats.done}/{stats.total} · {stats.percent}%
          </span>
        </div>
        <Progress value={stats.percent} className="w-full shrink-0" />
        <p className="text-[11px] text-muted-foreground tabular-nums">
          Todo {stats.todo} · IP {stats.inProgress} · Done {stats.done}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium">{t.children}</p>
        {children.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto overscroll-contain">
            {children.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start gap-2 rounded-md border border-transparent px-1.5 py-1 text-start hover:border-border hover:bg-muted/50"
                  onClick={() => openIssue(c.key)}
                >
                  <span
                    className="shrink-0 font-mono text-[11px] text-primary"
                    translate="no"
                  >
                    {c.key}
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] leading-snug line-clamp-2">
                    {c.summary}
                  </span>
                  <Badge
                    className={`shrink-0 text-[10px] ${getIssueTypeBadgeClass(c.issuetype)}`}
                  >
                    {c.issuetype}
                  </Badge>
                  <IssueStatusBadge
                    status={c.status}
                    statusCategoryKey={c.statusCategoryKey}
                    className="shrink-0 text-[10px]"
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
