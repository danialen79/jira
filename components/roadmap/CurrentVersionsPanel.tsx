"use client";

import { useCallback, useEffect, useState } from "react";
import { GanttChart } from "lucide-react";
import type {
  Language,
  JiraVersion,
  VersionIssue,
  VersionProgressSummary,
} from "@/lib/types";
import {
  formatRoadmapDate,
  getVersionStatusLabel,
} from "@/lib/roadmap";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import VersionIssueList from "@/components/roadmap/VersionIssueList";

type Props = {
  versions: JiraVersion[];
  language: Language;
  jiraUrl: string;
  onOpenVersion: (v: JiraVersion) => void;
};

type VersionBundle =
  | { state: "loading" }
  | { state: "error" }
  | {
      state: "ok";
      progress: VersionProgressSummary;
      issues: VersionIssue[];
      total: number;
    };

const copy = {
  en: {
    noCurrent: "No versions in progress",
    noCurrentHint: "No unreleased version covers today.",
    start: "Start",
    release: "Release",
    todo: "To Do",
    inProgress: "In Progress",
    done: "Done",
    canceled: "Canceled",
    progress: "Progress",
    archived: "Archived",
    released: "Released",
    overdue: "Overdue",
    unreleased: "Unreleased",
    loading: "Loading…",
  },
  fa: {
    noCurrent: "ورژن فعالی نیست",
    noCurrentHint: "هیچ ورژن منتشرنشده‌ای امروز را پوشش نمی‌دهد.",
    start: "شروع",
    release: "انتشار",
    todo: "انجام‌نشده",
    inProgress: "در حال انجام",
    done: "انجام‌شده",
    canceled: "لغوشده",
    progress: "پیشرفت",
    archived: "بایگانی",
    released: "منتشرشده",
    overdue: "عقب‌افتاده",
    unreleased: "منتشرنشده",
    loading: "در حال بارگذاری…",
  },
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

export default function CurrentVersionsPanel({
  versions,
  language,
  jiraUrl,
  onOpenVersion,
}: Props) {
  const t = copy[language];
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
          if (!res.ok || !data.success || !data.progress) {
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
              progress: data.progress,
              issues: data.issues || [],
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

  if (versions.length === 0) {
    return (
      <Empty className="border py-12">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GanttChart />
          </EmptyMedia>
          <EmptyTitle>{t.noCurrent}</EmptyTitle>
          <EmptyDescription>{t.noCurrentHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid h-[min(70vh,40rem)] auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {versions.map((v) => {
        const bundle = bundles[v.id];
        const status = getVersionStatusLabel(v);
        return (
          <Card
            key={v.id}
            className="h-full cursor-pointer transition-colors hover:bg-muted/40"
            onClick={() => onOpenVersion(v)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenVersion(v);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <CardHeader className="shrink-0 gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusBadgeVariant(status)}>{t[status]}</Badge>
              </div>
              <CardTitle className="text-base leading-snug text-pretty">
                {v.name}
              </CardTitle>
              <CardDescription>
                {t.start}: {formatRoadmapDate(v.startDate, language)} ·{" "}
                {t.release}: {formatRoadmapDate(v.releaseDate, language)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
              {bundle == null || bundle.state === "loading" ? (
                <div className="flex flex-1 flex-col gap-2">
                  <p className="text-xs text-muted-foreground">{t.loading}</p>
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="min-h-16 w-full flex-1" />
                </div>
              ) : bundle.state === "error" ? (
                <p className="text-xs text-destructive">—</p>
              ) : (
                <>
                  <Progress value={bundle.progress.percent} className="shrink-0">
                    <ProgressLabel>{t.progress}</ProgressLabel>
                    <ProgressValue className="tabular-nums" />
                  </Progress>
                  <div className="flex shrink-0 flex-wrap gap-2 text-xs tabular-nums text-muted-foreground">
                    <span>
                      {t.todo}: {bundle.progress.todo}
                    </span>
                    <span>
                      {t.inProgress}: {bundle.progress.inProgress}
                    </span>
                    <span>
                      {t.done}: {bundle.progress.done}
                    </span>
                    {bundle.progress.canceled > 0 && (
                      <span>
                        {t.canceled}: {bundle.progress.canceled}
                      </span>
                    )}
                  </div>
                  <VersionIssueList
                    issues={bundle.issues}
                    total={bundle.total}
                    jiraUrl={jiraUrl}
                    language={language}
                    compact
                    className="min-h-0 flex-1"
                  />
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
