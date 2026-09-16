"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PanelLeftIcon,
  TicketIcon,
  XIcon,
} from "lucide-react";
import { IssuePeekActions } from "@/components/issue-peek/IssuePeekActions";
import { IssuePeekBody } from "@/components/issue-peek/IssuePeekBody";
import { IssuePeekKv } from "@/components/issue-peek/IssuePeekKv";
import { IssuePeekRewriteDialog } from "@/components/issue-peek/IssuePeekRewriteDialog";
import { IssuePeekSearch } from "@/components/issue-peek/IssuePeekSearch";
import { IssuePeekTrail } from "@/components/issue-peek/IssuePeekTrail";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { getIssueTypeBadgeClass, normalizeIssueTypeName } from "@/lib/issue-type-badge";
import {
  DOCK_RAIL_PX,
  OVERLAY_BREAKPOINT_PX,
  clampDockWidth,
  readDockWidth,
  writeDockWidth,
} from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
  title: "ایشو",
  expand: "باز کردن پنل ایشو",
  collapse: "بستن پنل ایشو",
  clear: "پاک کردن",
  empty: "کلید ایشو را وارد کنید",
  emptyHint: "از برد کلیک کنید یا Ctrl+Shift+J",
  disconnected: "جیرا را در تنظیمات وصل کنید.",
  loading: "در حال بارگذاری…",
  meta: "جزئیات",
  resize: "تغییر عرض پنل",
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
    rewriteOpen,
    setRewriteOpen,
  } = useIssuePeek();

  const [dockWidth, setDockWidth] = useState(400);
  const [overlay, setOverlay] = useState(false);
  const [metaOpen, setMetaOpen] = useState(true);
  const dragging = useRef(false);

  useEffect(() => {
    setDockWidth(readDockWidth());
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${OVERLAY_BREAKPOINT_PX - 1}px)`);
    const apply = () => setOverlay(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (overlay || collapsed) return;
      e.preventDefault();
      dragging.current = true;
      const startX = e.clientX;
      const startW = dockWidth;
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        // Dock is on the left in LTR shell; drag right = grow.
        const next = clampDockWidth(startW + (ev.clientX - startX));
        setDockWidth(next);
      };
      const onUp = (ev: PointerEvent) => {
        dragging.current = false;
        el.releasePointerCapture(ev.pointerId);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setDockWidth((w) => {
          writeDockWidth(w);
          return w;
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [collapsed, dockWidth, overlay]
  );

  const isBug = issue
    ? normalizeIssueTypeName(issue.issuetype) === "bug"
    : false;

  // Overlay + collapsed: hide completely (header ticket button reopens).
  if (overlay && collapsed) {
    return null;
  }

  const width = collapsed ? DOCK_RAIL_PX : dockWidth;
  const chromeTitle = issueKey || t.title;

  return (
    <aside
      data-slot="issue-peek-dock"
      data-overlay={overlay ? "true" : undefined}
      aria-label={t.title}
      className={cn(
        "z-20 flex shrink-0 flex-col border-e border-border bg-background",
        overlay
          ? "fixed top-14 bottom-0 start-0 shadow-lg"
          : "sticky top-14 h-[calc(100svh-3.5rem)]",
        !collapsed &&
          "motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none"
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
          className="relative flex h-full min-h-0 flex-col overscroll-contain"
          dir="rtl"
        >
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <TicketIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <p
              className="min-w-0 flex-1 truncate text-sm font-medium font-mono"
              translate={issueKey ? "no" : undefined}
            >
              {chromeTitle}
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

          <div className="shrink-0 border-b px-3 py-2">
            <IssuePeekSearch />
          </div>
          <IssuePeekTrail />

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {!jiraConnected ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">
                {t.disconnected}
              </p>
            ) : loading && !issue ? (
              <div className="flex flex-col gap-2 px-3 py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-20 w-full" />
                <p className="text-xs text-muted-foreground">{t.loading}</p>
              </div>
            ) : error && !issue ? (
              <p
                className="px-3 py-3 text-xs text-destructive break-words"
                role="alert"
              >
                {error}
              </p>
            ) : !issue ? (
              <div className="flex flex-col gap-1 px-3 py-6 text-center">
                <p className="text-sm font-medium">{t.empty}</p>
                <p className="text-xs text-muted-foreground">{t.emptyHint}</p>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="sticky top-0 z-[1] flex flex-col gap-2 border-b bg-background/95 px-3 py-3 backdrop-blur-sm">
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
                  <IssuePeekActions issue={issue} />
                </div>

                <div className="flex flex-col gap-3 px-3 py-3">
                  <Collapsible open={metaOpen} onOpenChange={setMetaOpen}>
                    <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
                      <ChevronDownIcon
                        className={cn(
                          "size-3.5 transition-transform",
                          !metaOpen && "-rotate-90"
                        )}
                      />
                      {t.meta}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <IssuePeekKv
                        issue={issue}
                        omit={isBug ? ["priority"] : []}
                        onOpenKey={openIssue}
                      />
                    </CollapsibleContent>
                  </Collapsible>

                  <IssuePeekBody issue={issue} />
                </div>
              </div>
            )}
          </div>

          {!overlay ? (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t.resize}
              title={t.resize}
              tabIndex={0}
              className="absolute inset-y-0 end-0 z-10 w-1.5 cursor-col-resize touch-none bg-transparent hover:bg-border/80"
              onPointerDown={onResizePointerDown}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  setDockWidth((w) => {
                    const next = clampDockWidth(w + 16);
                    writeDockWidth(next);
                    return next;
                  });
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  setDockWidth((w) => {
                    const next = clampDockWidth(w - 16);
                    writeDockWidth(next);
                    return next;
                  });
                }
              }}
            />
          ) : null}
        </div>
      )}
      {issue ? (
        <IssuePeekRewriteDialog
          open={rewriteOpen}
          onOpenChange={setRewriteOpen}
          issue={issue}
        />
      ) : null}
    </aside>
  );
}
