"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FlagIcon,
  PlayIcon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { toast } from "sonner";
import CompleteSprintDialog from "@/components/sprint/CompleteSprintDialog";
import CreateSprintDialog from "@/components/sprint/CreateSprintDialog";
import SprintChartsPanel from "@/components/sprint/SprintChartsPanel";
import SprintHealthStrip from "@/components/sprint/SprintHealthStrip";
import SprintScopePanel from "@/components/sprint/SprintScopePanel";
import SprintWorkPanel from "@/components/sprint/SprintWorkPanel";
import SearchableSelect from "@/components/SearchableSelect";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SprintHealth, BurndownPoint, VelocityBar } from "@/lib/sprint/metrics";
import type { JiraSprint, Language, SprintIssue } from "@/lib/types";

type Props = {
  language: Language;
  isRtl: boolean;
  jiraUrl: string;
  jiraConnected: boolean;
};

type ReportPayload = {
  health: SprintHealth;
  scope: {
    added: Array<{ key: string; summary?: string }>;
    removed: Array<{ key: string; summary?: string }>;
    addedCount: number;
    removedCount: number;
    limited: boolean;
  };
  commitmentReliability: number | null;
  burndown: { points: BurndownPoint[]; limited: boolean };
  velocity: {
    bars: VelocityBar[];
    averageCompleted: number | null;
    currentCommitted: number;
  };
};

const copy = {
  en: {
    subtitle: "Active sprint health, moves, and forecasts.",
    refresh: "Refresh",
    create: "New sprint",
    start: "Start",
    complete: "Complete",
    pickSprint: "Select sprint",
    noBoardTitle: "Scrum board not set",
    noBoardHint: "Pick the SIP Scrum board in Settings.",
    settings: "Open Settings",
    notConnected: "Jira is not connected",
    notConnectedHint: "Configure Jira env, then refresh.",
    noSprints: "No sprints",
    noSprintsHint: "Create a future sprint to begin.",
    work: "Work",
    scope: "Scope",
    charts: "Charts",
    goal: "Goal",
    active: "Active",
    future: "Future",
    closed: "Closed",
    started: "Sprint started.",
    startFail: "Could not start sprint.",
    loadFail: "Could not load sprints.",
  },
  fa: {
    subtitle: "سلامت اسپرینت جاری، انتقال و پیش‌بینی.",
    refresh: "بروزرسانی",
    create: "اسپرینت جدید",
    start: "شروع",
    complete: "بستن",
    pickSprint: "انتخاب اسپرینت",
    noBoardTitle: "بورد اسکرام تنظیم نشده",
    noBoardHint: "بورد SIP اسکرام را در Settings انتخاب کنید.",
    settings: "باز کردن Settings",
    notConnected: "جیرا متصل نیست",
    notConnectedHint: "env جیرا را تنظیم کنید، سپس تازه کنید.",
    noSprints: "اسپرینتی نیست",
    noSprintsHint: "یک اسپرینت آینده بسازید.",
    work: "کارها",
    scope: "اسکوپ",
    charts: "نمودارها",
    goal: "هدف",
    active: "فعال",
    future: "آینده",
    closed: "بسته",
    started: "اسپرینت شروع شد.",
    startFail: "شروع اسپرینت ناموفق بود.",
    loadFail: "بارگذاری اسپرینت‌ها ناموفق بود.",
  },
} as const;

export default function SprintControlCenter({
  language,
  isRtl,
  jiraUrl,
  jiraConnected,
}: Props) {
  const t = copy[language];
  const [sprints, setSprints] = useState<JiraSprint[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [issues, setIssues] = useState<SprintIssue[]>([]);
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsBoard, setNeedsBoard] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const selected = useMemo(
    () => sprints.find((s) => String(s.id) === selectedId) || null,
    [sprints, selectedId]
  );

  const futureSprints = useMemo(
    () => sprints.filter((s) => s.state === "future"),
    [sprints]
  );

  const loadSprints = useCallback(async () => {
    if (!jiraConnected) {
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    setError(null);
    setNeedsBoard(false);
    try {
      const res = await fetch("/api/jira/sprints");
      const data = await res.json();
      if (res.status === 503 && /board/i.test(data.error || "")) {
        setNeedsBoard(true);
        setSprints([]);
        return;
      }
      if (!res.ok) throw new Error(data.error || t.loadFail);
      const list = (data.sprints || []) as JiraSprint[];
      setSprints(list);
      setSelectedId((prev) => {
        if (prev && list.some((s) => String(s.id) === prev)) return prev;
        const active = list.find((s) => s.state === "active");
        if (active) return String(active.id);
        const future = list.find((s) => s.state === "future");
        if (future) return String(future.id);
        return list[0] ? String(list[0].id) : "";
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.loadFail);
    } finally {
      setLoadingList(false);
    }
  }, [jiraConnected, t.loadFail]);

  const loadDetail = useCallback(async (sprintId: string) => {
    if (!sprintId) {
      setIssues([]);
      setReport(null);
      return;
    }
    setLoadingDetail(true);
    try {
      const [issuesRes, reportRes] = await Promise.all([
        fetch(`/api/jira/sprints/${sprintId}/issues`),
        fetch(`/api/jira/sprints/${sprintId}/report`),
      ]);
      const issuesData = await issuesRes.json();
      if (!issuesRes.ok) throw new Error(issuesData.error || "issues failed");
      setIssues(issuesData.issues || []);

      if (reportRes.ok) {
        const reportData = await reportRes.json();
        setReport({
          health: reportData.health,
          scope: reportData.scope,
          commitmentReliability: reportData.commitmentReliability,
          burndown: reportData.burndown,
          velocity: reportData.velocity,
        });
      } else if (issuesData.health) {
        setReport({
          health: issuesData.health,
          scope: {
            added: [],
            removed: [],
            addedCount: 0,
            removedCount: 0,
            limited: true,
          },
          commitmentReliability: issuesData.health.percentDone,
          burndown: { points: [], limited: true },
          velocity: {
            bars: [],
            averageCompleted: null,
            currentCommitted: issuesData.health.total,
          },
        });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadSprints();
  }, [loadSprints]);

  useEffect(() => {
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const refreshAll = useCallback(async () => {
    await loadSprints();
    if (selectedId) await loadDetail(selectedId);
  }, [loadDetail, loadSprints, selectedId]);

  const handleStart = async () => {
    if (!selected || selected.state !== "future") return;
    try {
      const res = await fetch(`/api/jira/sprints/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: "active" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.startFail);
      toast.success(t.started);
      await refreshAll();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.startFail);
    }
  };

  const sprintOptions = sprints.map((s) => ({
    value: String(s.id),
    label: s.name,
    sublabel:
      s.state === "active"
        ? t.active
        : s.state === "future"
          ? t.future
          : t.closed,
  }));

  if (!jiraConnected) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t.notConnected}</EmptyTitle>
          <EmptyDescription>{t.notConnectedHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (needsBoard) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t.noBoardTitle}</EmptyTitle>
          <EmptyDescription>{t.noBoardHint}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/settings" />}>{t.settings}</Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void refreshAll()}>
            <RefreshCwIcon data-icon="inline-start" />
            {t.refresh}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            {t.create}
          </Button>
        </div>
      </div>

      {error && (
        <Alert>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loadingList ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
        </div>
      ) : sprints.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t.noSprints}</EmptyTitle>
            <EmptyDescription>{t.noSprintsHint}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreateOpen(true)}>{t.create}</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <SearchableSelect
                options={sprintOptions}
                value={selectedId}
                onChange={setSelectedId}
                placeholder={t.pickSprint}
                isRtl={isRtl}
              />
            </div>
            {selected && (
              <Badge
                variant={
                  selected.state === "active"
                    ? "success"
                    : selected.state === "future"
                      ? "secondary"
                      : "outline"
                }
              >
                {selected.state === "active"
                  ? t.active
                  : selected.state === "future"
                    ? t.future
                    : t.closed}
              </Badge>
            )}
            {selected?.state === "future" && (
              <Button size="sm" onClick={() => void handleStart()}>
                <PlayIcon data-icon="inline-start" />
                {t.start}
              </Button>
            )}
            {selected?.state === "active" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCompleteOpen(true)}
              >
                <FlagIcon data-icon="inline-start" />
                {t.complete}
              </Button>
            )}
          </div>

          {selected?.goal && (
            <p className="text-sm">
              <span className="text-muted-foreground">{t.goal}: </span>
              {selected.goal}
            </p>
          )}

          <SprintHealthStrip
            language={language}
            health={report?.health ?? null}
            scopeDelta={
              report
                ? report.scope.addedCount - report.scope.removedCount
                : 0
            }
            reliability={report?.commitmentReliability}
          />

          <Tabs defaultValue="work">
            <TabsList>
              <TabsTrigger value="work">{t.work}</TabsTrigger>
              <TabsTrigger value="scope">{t.scope}</TabsTrigger>
              <TabsTrigger value="charts">{t.charts}</TabsTrigger>
            </TabsList>
            <TabsContent value="work" className="mt-3">
              <SprintWorkPanel
                language={language}
                isRtl={isRtl}
                jiraUrl={jiraUrl}
                issues={issues}
                loading={loadingDetail}
                futureSprints={futureSprints}
                currentSprintId={selected?.id ?? null}
                onMoved={() => void loadDetail(selectedId)}
              />
            </TabsContent>
            <TabsContent value="scope" className="mt-3">
              <SprintScopePanel
                language={language}
                added={report?.scope.added || []}
                removed={report?.scope.removed || []}
                limited={report?.scope.limited ?? true}
                jiraUrl={jiraUrl}
              />
            </TabsContent>
            <TabsContent value="charts" className="mt-3">
              <SprintChartsPanel
                language={language}
                burndown={report?.burndown.points || []}
                burndownLimited={report?.burndown.limited ?? true}
                velocity={report?.velocity.bars || []}
                avgVelocity={report?.velocity.averageCompleted ?? null}
                currentCommitted={report?.velocity.currentCommitted ?? 0}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <CreateSprintDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        language={language}
        onCreated={() => void refreshAll()}
      />
      <CompleteSprintDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        language={language}
        sprint={selected}
        issues={issues}
        futureSprints={futureSprints}
        onCompleted={() => void refreshAll()}
      />
    </div>
  );
}
