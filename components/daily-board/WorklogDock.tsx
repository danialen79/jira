"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  History,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import type { Language } from "@/lib/types";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import type {
  AIWorklogPlanItem,
  DailyBoardIssue,
  RecentLogItem,
  WorklogChip,
} from "@/lib/daily-board/types";
import { formatJiraWorklogStarted } from "@/lib/jira-worklog-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    chipsEmpty: "Add tickets with +",
    timePh: "2h 30m",
    notePh: "Note…",
    logBtn: "Log",
    logging: "Logging…",
    tabLog: "Log",
    tabAi: "AI",
    tabRecent: "Recent",
    aiPlaceholder: "What you did today…",
    aiAnalyze: "Analyze",
    aiPlanning: "Analyzing…",
    aiPublish: "Publish",
    aiPublishing: "Publishing…",
    needChips: "Add a ticket chip first.",
    needFocus: "Select a ticket chip.",
    needTime: "Enter time spent.",
    logOk: "Work logged.",
    planEmpty: "No plan items.",
    publishOk: "Worklogs published.",
    clearChips: "Clear",
    removeChip: "Remove",
    expand: "Expand",
    collapse: "Collapse",
    noRecent: "No recent logs.",
  },
  fa: {
    chipsEmpty: "با + ایشو اضافه کنید",
    timePh: "۲h ۳۰m",
    notePh: "توضیح…",
    logBtn: "ثبت",
    logging: "در حال ثبت…",
    tabLog: "ثبت",
    tabAi: "AI",
    tabRecent: "اخیر",
    aiPlaceholder: "امروز چه کردید…",
    aiAnalyze: "تحلیل",
    aiPlanning: "در حال تحلیل…",
    aiPublish: "انتشار",
    aiPublishing: "در حال انتشار…",
    needChips: "اول یک ایشو اضافه کنید.",
    needFocus: "یک چیپ ایشو را انتخاب کنید.",
    needTime: "زمان را وارد کنید.",
    logOk: "کارکرد ثبت شد.",
    planEmpty: "آیتمی نیست.",
    publishOk: "کارکردها ثبت شد.",
    clearChips: "پاک",
    removeChip: "حذف",
    expand: "باز",
    collapse: "بسته",
    noRecent: "لاگ اخیری نیست.",
  },
};

type DockTab = "log" | "ai" | "recent";

function getLocalDatetimeString() {
  return formatJiraWorklogStarted(new Date());
}

export default function WorklogDock({
  language,
  isRtl,
  jiraUrl,
  chips,
  focusedKey,
  onFocusChip,
  onRemoveChip,
  onClearChips,
  chipIssues,
  recentLogs,
  onLogged,
}: {
  language: Language;
  isRtl: boolean;
  jiraUrl: string;
  chips: WorklogChip[];
  focusedKey: string | null;
  onFocusChip: (key: string) => void;
  onRemoveChip: (key: string) => void;
  onClearChips: () => void;
  chipIssues: DailyBoardIssue[];
  recentLogs: RecentLogItem[];
  onLogged: () => void;
}) {
  const t = copy[language];
  const { aiProvider, selectedModel } = useAiSettings();

  const [tab, setTab] = useState<DockTab>("log");
  const [expanded, setExpanded] = useState(false);

  const [logTime, setLogTime] = useState("");
  const [logComment, setLogComment] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPlanning, setAiPlanning] = useState(false);
  const [aiPlan, setAiPlan] = useState<AIWorklogPlanItem[]>([]);
  const [publishing, setPublishing] = useState(false);

  const focused = useMemo(
    () => chips.find((c) => c.key === focusedKey) || chips[0] || null,
    [chips, focusedKey]
  );

  const handleQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!focused) {
      toast.error(t.needFocus);
      return;
    }
    if (!logTime.trim()) {
      toast.error(t.needTime);
      return;
    }
    setSubmittingLog(true);
    try {
      const res = await fetch("/api/jira/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: focused.key,
          timeSpent: logTime.trim(),
          comment: logComment.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed");
      }
      const spent = logTime.trim();
      const comment = logComment.trim();
      toast.success(t.logOk);
      setLogTime("");
      setLogComment("");
      void fetch("/api/recent-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: focused.key,
          summary: focused.summary,
          timeSpent: spent,
          comment,
          url: `${(jiraUrl || "").replace(/\/$/, "")}/browse/${focused.key}`,
        }),
      }).catch(() => {});
      onLogged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmittingLog(false);
    }
  };

  const handleAnalyze = async () => {
    if (!aiPrompt.trim()) return;
    if (chips.length === 0) {
      toast.error(t.needChips);
      return;
    }
    setAiPlanning(true);
    setAiPlan([]);
    setExpanded(true);
    setTab("ai");
    try {
      const res = await fetch("/api/jira/ai-worklog-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          issues: chipIssues.length
            ? chipIssues
            : chips.map((c) => ({
                key: c.key,
                summary: c.summary,
                issuetype: "Story",
                status: "",
                assignee: "",
              })),
          language,
          model: selectedModel,
          provider: aiProvider,
          constrainToIssues: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed");
      }
      const chipKeys = new Set(chips.map((c) => c.key));
      const proposals = (data.proposals || []).map((item: any, idx: number) => {
        let parentKey = String(item.parentKey || "").trim();
        if (!chipKeys.has(parentKey)) {
          const candidates = (item.candidateParentKeys || []).filter(
            (k: string) => chipKeys.has(k)
          );
          parentKey = candidates[0] || chips[0]?.key || "";
        }
        return {
          id: `proposal-${idx}-${Date.now()}`,
          parentType: "existing" as const,
          parentKey,
          candidateParentKeys: item.candidateParentKeys || [],
          proposedParentStory: item.proposedParentStory,
          subTaskSummary: item.subTaskSummary || "",
          timeSpent: item.timeSpent || "",
          comment: item.comment || "",
          started: getLocalDatetimeString(),
          selected: true,
          status: "pending" as const,
        };
      });
      setAiPlan(proposals);
      if (proposals.length === 0) toast.error(t.planEmpty);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setAiPlanning(false);
    }
  };

  const handlePublish = async () => {
    const selected = aiPlan.filter((i) => i.selected);
    if (selected.length === 0) return;
    setPublishing(true);
    const next = [...aiPlan];
    const chipKeys = new Set(chips.map((c) => c.key));

    for (let i = 0; i < next.length; i++) {
      const item = next[i];
      if (!item.selected) continue;
      const issueKey = (item.parentKey || "").trim();
      if (!issueKey || !chipKeys.has(issueKey)) {
        next[i] = {
          ...item,
          status: "failed",
          error: language === "fa" ? "کلید ایشو نامعتبر" : "Invalid issue key",
        };
        setAiPlan([...next]);
        continue;
      }
      next[i] = { ...item, status: "logging", error: undefined };
      setAiPlan([...next]);
      try {
        const res = await fetch("/api/jira/worklog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueKey,
            timeSpent: item.timeSpent,
            comment: item.comment,
            started: item.started,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed");
        }
        const summary =
          chips.find((c) => c.key === issueKey)?.summary ||
          item.subTaskSummary ||
          issueKey;
        void fetch("/api/recent-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueKey,
            summary,
            timeSpent: item.timeSpent,
            comment: item.comment,
            url: `${(jiraUrl || "").replace(/\/$/, "")}/browse/${issueKey}`,
          }),
        }).catch(() => {});
        next[i] = { ...item, status: "success" };
      } catch (err) {
        next[i] = {
          ...item,
          status: "failed",
          error: err instanceof Error ? err.message : "Failed",
        };
      }
      setAiPlan([...next]);
    }

    const failed = next.filter((i) => i.selected && i.status === "failed");
    if (failed.length === 0) {
      toast.success(t.publishOk);
      setAiPrompt("");
    } else {
      toast.error(
        language === "fa"
          ? `${failed.length} مورد ناموفق`
          : `${failed.length} failed`
      );
    }
    setPublishing(false);
    onLogged();
  };

  const selectedPlanCount = aiPlan.filter((i) => i.selected).length;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur supports-backdrop-filter:bg-background/90"
      dir={isRtl ? "rtl" : "ltr"}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-[1920px] flex-col gap-2 p-2.5 md:px-4">
        {/* Chips row */}
        <div className="flex min-h-8 items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pe-1">
            {chips.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t.chipsEmpty}</p>
            ) : (
              chips.map((chip) => (
                <Badge
                  key={chip.key}
                  variant={
                    focused?.key === chip.key ? "default" : "secondary"
                  }
                  translate="no"
                  className={cn(
                    "max-w-40 shrink-0 cursor-pointer gap-1 py-1 pe-1",
                    focused?.key === chip.key && "ring-2 ring-primary/30"
                  )}
                  onClick={() => onFocusChip(chip.key)}
                >
                  <span className="truncate font-mono text-[10px]">
                    {chip.key}
                  </span>
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-background/20"
                    aria-label={t.removeChip}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveChip(chip.key);
                    }}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              ))
            )}
          </div>
          {chips.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearChips}
              className="shrink-0"
            >
              <Trash2 data-icon="inline-start" />
              {t.clearChips}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={expanded ? t.collapse : t.expand}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown /> : <ChevronUp />}
          </Button>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (v === "log" || v === "ai" || v === "recent") {
              setTab(v);
              if (v !== "log") setExpanded(true);
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <TabsList variant="default" className="shrink-0">
              <TabsTrigger value="log">{t.tabLog}</TabsTrigger>
              <TabsTrigger value="ai">
                <Sparkles data-icon="inline-start" />
                {t.tabAi}
                {aiPlan.length > 0 ? (
                  <Badge variant="secondary" className="ms-1 tabular-nums">
                    {aiPlan.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="recent">
                <History data-icon="inline-start" />
                {t.tabRecent}
              </TabsTrigger>
            </TabsList>

            {tab === "log" ? (
              <form
                onSubmit={handleQuickLog}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
              >
                <InputGroup className="w-24 shrink-0 sm:w-28">
                  <InputGroupInput
                    id="dock-time"
                    name="timeSpent"
                    autoComplete="off"
                    spellCheck={false}
                    value={logTime}
                    onChange={(e) => setLogTime(e.target.value)}
                    placeholder={t.timePh}
                    aria-label={t.timePh}
                    disabled={!focused}
                  />
                </InputGroup>
                <InputGroup className="min-w-[8rem] flex-1">
                  <InputGroupInput
                    id="dock-comment"
                    name="workNote"
                    autoComplete="off"
                    value={logComment}
                    onChange={(e) => setLogComment(e.target.value)}
                    placeholder={
                      focused
                        ? `${t.notePh} ${focused.key}`
                        : t.notePh
                    }
                    aria-label={t.notePh}
                    disabled={!focused}
                  />
                </InputGroup>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingLog || !focused}
                  className="shrink-0"
                >
                  {submittingLog ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Send data-icon="inline-start" />
                  )}
                  {submittingLog ? t.logging : t.logBtn}
                </Button>
              </form>
            ) : null}
          </div>

          {(expanded || tab !== "log") && (
            <>
              <TabsContent value="log" className="mt-0">
                {/* Compact log lives in the header row; keep panel empty when expanded */}
                <p className="sr-only">
                  {focused
                    ? `${t.tabLog} ${focused.key}`
                    : t.chipsEmpty}
                </p>
              </TabsContent>

              <TabsContent value="ai" className="mt-2 flex flex-col gap-2">
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder={t.aiPlaceholder}
                  rows={2}
                  className="min-h-14"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleAnalyze}
                    disabled={aiPlanning || !aiPrompt.trim()}
                  >
                    {aiPlanning ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Sparkles data-icon="inline-start" />
                    )}
                    {aiPlanning ? t.aiPlanning : t.aiAnalyze}
                  </Button>
                  {aiPlan.length > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={handlePublish}
                      disabled={publishing || selectedPlanCount === 0}
                    >
                      {publishing ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <CheckSquare data-icon="inline-start" />
                      )}
                      {publishing
                        ? t.aiPublishing
                        : `${t.aiPublish} (${selectedPlanCount})`}
                    </Button>
                  ) : null}
                </div>

                {aiPlan.length > 0 ? (
                  <div className="flex max-h-36 flex-col gap-2 overflow-y-auto pe-1">
                    {aiPlan.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-2 rounded-lg border bg-muted/40 p-2 text-xs"
                      >
                        <Checkbox
                          checked={!!item.selected}
                          onCheckedChange={() =>
                            setAiPlan((prev) =>
                              prev.map((p) =>
                                p.id === item.id
                                  ? { ...p, selected: !p.selected }
                                  : p
                              )
                            )
                          }
                          className="mt-0.5"
                          aria-label={item.parentKey || item.id}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge
                              variant="outline"
                              className="font-mono"
                              translate="no"
                            >
                              {item.parentKey}
                            </Badge>
                            <Badge
                              variant="secondary"
                              className="tabular-nums"
                            >
                              {item.timeSpent}
                            </Badge>
                            {item.status === "success" ? (
                              <CheckCircle className="size-3.5 text-success" />
                            ) : null}
                            {item.status === "failed" ? (
                              <span className="text-destructive">
                                {item.error}
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate font-medium">
                            {item.subTaskSummary}
                          </p>
                          <p className="line-clamp-2 text-muted-foreground">
                            {item.comment}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </TabsContent>

              <TabsContent value="recent" className="mt-2">
                <div className="flex max-h-36 flex-col gap-1.5 overflow-y-auto">
                  {recentLogs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t.noRecent}</p>
                  ) : (
                    recentLogs.slice(0, 8).map((log, idx) => (
                      <div
                        key={`${log.issueKey}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span
                            className="font-mono font-semibold"
                            translate="no"
                          >
                            {log.issueKey}
                          </span>
                          <p className="truncate text-muted-foreground">
                            {log.summary}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {log.timeSpent}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
}
