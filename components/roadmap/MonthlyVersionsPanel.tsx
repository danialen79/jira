"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarIcon, Layers } from "lucide-react";
import type { JiraVersion, VersionIssue, VersionProgressSummary } from "@/lib/types";
import { isSameJalaliMonth } from "@/lib/jalali";
import {
  computeVersionProgress,
  countVersionLenses,
  dedupeVersionIssuesByKey,
  flattenVersionIssues,
  formatRoadmapDate,
  formatVersionProductLabel,
  getVersionStatusLabel,
  toDateOnly,
} from "@/lib/roadmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import VersionIssueTree from "@/components/roadmap/VersionIssueTree";
import VersionStatsCharts from "@/components/roadmap/VersionStatsCharts";

type Props = {
  versions: JiraVersion[];
  monthAnchor: Date;
  jiraUrl: string;
  onOpenVersion: (v: JiraVersion) => void;
};

type VersionBundle =
  | { state: "loading" }
  | { state: "error" }
  | {
      state: "ok";
      progress: VersionProgressSummary | null;
      tree: VersionIssue[];
      total: number;
    };

const t = {
    empty: "ریلیزی در این ماه نیست",
    emptyHint: "هیچ ورژنی شروع یا پایانش در این ماه نیست.",
    monthSummary: "جمع ماه",
    versions: "ورژن‌ها",
    start: "شروع",
    release: "پایان",
    todo: "انجام‌نشده",
    inProgress: "در حال انجام",
    done: "انجام‌شده",
    canceled: "لغوشده",
    archived: "بایگانی",
    released: "منتشرشده",
    overdue: "عقب‌افتاده",
    unreleased: "منتشرنشده",
    loading: "در حال بارگذاری…",
    open: "باز کردن",
    boundaryStart: "شروع",
    boundaryEnd: "پایان",
    boundaryBoth: "شروع و پایان",
  } as const;

function statusBadgeVariant(
  label: ReturnType<typeof getVersionStatusLabel>
): "success" | "destructive" | "outline" | "secondary" {
  switch (label) {
    case "released":
      return "success";
    case "overdue":
      return "destructive";
    case "archived":
      return "secondary";
    default:
      return "outline";
  }
}

function isoInMonth(iso: string | undefined, anchor: Date): boolean {
  if (!iso) return false;
  return isSameJalaliMonth(toDateOnly(iso), anchor);
}

function boundaryKind(
  v: JiraVersion,
  monthAnchor: Date
): "start" | "end" | "both" | null {
  const startIn = isoInMonth(v.startDate, monthAnchor);
  const endIn = isoInMonth(v.releaseDate, monthAnchor);
  if (startIn && endIn) return "both";
  if (startIn) return "start";
  if (endIn) return "end";
  return null;
}

export default function MonthlyVersionsPanel({
  versions,
  monthAnchor,  jiraUrl,
  onOpenVersion,
}: Props) {
  const [bundles, setBundles] = useState<Record<string, VersionBundle>>({});

  const load = useCallback(async (list: JiraVersion[]) => {
    if (list.length === 0) {
      setBundles({});
      return;
    }
    setBundles((prev) => {
      const next = { ...prev };
      for (const v of list) next[v.id] = { state: "loading" };
      return next;
    });

    await Promise.all(
      list.map(async (v) => {
        try {
          const res = await fetch(
            `/api/jira/versions/issues?versionId=${encodeURIComponent(v.id)}`
          );
          const data = await res.json();
          if (!res.ok || !data.success) {
            setBundles((prev) => ({
              ...prev,
              [v.id]: { state: "error" },
            }));
            return;
          }
          setBundles((prev) => ({
            ...prev,
            [v.id]: {
              state: "ok",
              progress: (data.progress as VersionProgressSummary) || null,
              tree: (data.tree || data.issues || []) as VersionIssue[],
              total: data.total ?? (data.issues || []).length,
            },
          }));
        } catch {
          setBundles((prev) => ({
            ...prev,
            [v.id]: { state: "error" },
          }));
        }
      })
    );
  }, []);

  useEffect(() => {
    void load(versions);
  }, [versions, load]);

  const aggregateLoading = useMemo(() => {
    if (versions.length === 0) return false;
    return versions.some((v) => {
      const b = bundles[v.id];
      return b == null || b.state === "loading";
    });
  }, [versions, bundles]);

  const monthAggregate = useMemo(() => {
    if (aggregateLoading) return null;

    const trees: VersionIssue[] = [];
    for (const v of versions) {
      const b = bundles[v.id];
      if (b?.state !== "ok") continue;
      trees.push(...b.tree);
    }

    const flat = dedupeVersionIssuesByKey(flattenVersionIssues(trees));
    if (flat.length === 0) return null;

    return {
      progress: computeVersionProgress(flat),
      lensCounts: countVersionLenses(flat),
    };
  }, [versions, bundles, aggregateLoading]);

  if (versions.length === 0) {
    return (
      <Empty className="border py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CalendarIcon />
          </EmptyMedia>
          <EmptyTitle>{t.empty}</EmptyTitle>
          <EmptyDescription>{t.emptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-none">
        <h3 className="text-center text-xs font-medium text-muted-foreground">
          {t.monthSummary}
        </h3>
        {aggregateLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="size-40 rounded-full" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="size-40 rounded-full" />
            </div>
          </div>
        ) : monthAggregate ? (
          <VersionStatsCharts
            progress={monthAggregate.progress}
            lensCounts={monthAggregate.lensCounts}
            />
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">—</p>
        )}
      </section>

      <p className="text-xs font-medium text-muted-foreground">{t.versions}</p>

      {versions.map((v) => {
        const bundle = bundles[v.id];
        const status = getVersionStatusLabel(v);
        const title = formatVersionProductLabel(v.name);
        const boundary = boundaryKind(v, monthAnchor);
        const boundaryLabel =
          boundary === "both"
            ? t.boundaryBoth
            : boundary === "start"
              ? t.boundaryStart
              : boundary === "end"
                ? t.boundaryEnd
                : null;

        return (
          <section
            key={v.id}
            className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-none"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(status)}>{t[status]}</Badge>
                  {boundaryLabel ? (
                    <Badge variant="secondary">{boundaryLabel}</Badge>
                  ) : null}
                </div>
                <h3
                  className="text-base font-semibold leading-snug tracking-tight text-pretty"
                  translate="no"
                >
                  {title}
                </h3>
                <p className="text-xs text-muted-foreground" translate="no">
                  {v.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.start}: {formatRoadmapDate(v.startDate)} ·{" "}
                  {t.release}: {formatRoadmapDate(v.releaseDate)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenVersion(v)}
              >
                {t.open}
              </Button>
            </header>

            {bundle == null || bundle.state === "loading" ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">{t.loading}</p>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : bundle.state === "error" ? (
              <Empty className="border py-6">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Layers />
                  </EmptyMedia>
                  <EmptyTitle>—</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-3">
                {bundle.progress ? (
                  <div className="flex flex-wrap gap-3 text-xs tabular-nums text-muted-foreground">
                    <span>
                      {t.todo}: {bundle.progress.todo}
                    </span>
                    <span>
                      {t.inProgress}: {bundle.progress.inProgress}
                    </span>
                    <span>
                      {t.done}: {bundle.progress.done}
                    </span>
                    {bundle.progress.canceled > 0 ? (
                      <span>
                        {t.canceled}: {bundle.progress.canceled}
                      </span>
                    ) : null}
                  </div>
                ) : null}
                <VersionIssueTree
                  tree={bundle.tree}
                  total={bundle.total}
                  jiraUrl={jiraUrl}
                  />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
