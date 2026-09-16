"use client";

import {
  ChevronRightIcon,
  PanelLeftIcon,
  TicketIcon,
  XIcon,
} from "lucide-react";
import { IssuePeekActions } from "@/components/issue-peek/IssuePeekActions";
import { IssuePeekBody } from "@/components/issue-peek/IssuePeekBody";
import { IssuePeekKv } from "@/components/issue-peek/IssuePeekKv";
import { IssuePeekSearch } from "@/components/issue-peek/IssuePeekSearch";
import { IssuePeekTrail } from "@/components/issue-peek/IssuePeekTrail";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { DOCK_RAIL_PX, DOCK_WIDTH_PX } from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
    title: "ایشو",
    expand: "باز کردن پنل ایشو",
    collapse: "بستن پنل ایشو",
    clear: "پاک کردن",
    empty: "کلید ایشو را وارد کنید",
    emptyHint: "برای نمایش، بارگذاری کنید.",
    disconnected: "جیرا را در تنظیمات وصل کنید.",
    loading: "در حال بارگذاری…",
  } as const;

export function IssuePeekDock() {
  const { jiraConnected } = useJiraApp();
  const {
    collapsed,
    setCollapsed,
    expandAndFocusSearch,
    issue,
    issueKey,
    loading,
    error,
    clearIssue,
    openIssue,
  } = useIssuePeek();

  const width = collapsed ? DOCK_RAIL_PX : DOCK_WIDTH_PX;

  return (
    <aside
      data-slot="issue-peek-dock"
      aria-label={t.title}
      className={cn(
        "sticky top-14 z-10 flex h-[calc(100svh-3.5rem)] shrink-0 flex-col border-e border-border bg-background",
        "motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out",
        "motion-reduce:transition-none"
      )}
      style={{ width }}
    >
      {collapsed ? (
        <div className="flex h-full flex-col items-center gap-2 py-3">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t.expand}
            title={t.expand}
            onClick={expandAndFocusSearch}
          >
            <PanelLeftIcon />
          </Button>
          <TicketIcon className="size-4 text-muted-foreground" aria-hidden />
          {issueKey ? (
            <span
              className="mt-1 max-h-40 overflow-hidden text-[10px] font-mono text-muted-foreground"
              style={{ writingMode: "vertical-rl" }}
              translate="no"
            >
              {issueKey}
            </span>
          ) : null}
        </div>
      ) : (
        <div
          className="flex h-full min-h-0 flex-col overscroll-contain"
          dir="rtl"
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <TicketIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {t.title}
            </p>
            {issueKey ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t.clear}
                title={t.clear}
                onClick={clearIssue}
              >
                <XIcon />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={t.collapse}
              title={t.collapse}
              onClick={() => setCollapsed(true)}
            >
              <ChevronRightIcon />
            </Button>
          </div>

          <div className="border-b px-3 py-2">
            <IssuePeekSearch />
          </div>
          <IssuePeekTrail />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
            {!jiraConnected ? (
              <p className="text-xs text-muted-foreground">{t.disconnected}</p>
            ) : loading && !issue ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-20 w-full" />
                <p className="text-xs text-muted-foreground">{t.loading}</p>
              </div>
            ) : error && !issue ? (
              <p className="text-xs text-destructive break-words">{error}</p>
            ) : !issue ? (
              <div className="flex flex-col gap-1 py-6 text-center">
                <p className="text-sm font-medium">{t.empty}</p>
                <p className="text-xs text-muted-foreground">{t.emptyHint}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <IssuePeekActions issue={issue} />
                <Separator />
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={getIssueTypeBadgeClass(issue.issuetype)}>
                      {issue.issuetype}
                    </Badge>
                    <span
                      className="font-mono text-xs font-semibold"
                      translate="no"
                    >
                      {issue.key}
                    </span>
                    <IssueStatusBadge
                      status={issue.status}
                      statusCategoryKey={issue.statusCategoryKey}
                    />
                  </div>
                  <h2 className="text-sm font-medium leading-snug text-pretty">
                    {issue.summary}
                  </h2>
                </div>
                <Separator />
                <IssuePeekKv issue={issue} onOpenKey={openIssue} />
                <Separator />
                <IssuePeekBody issue={issue} />
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
