"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  CopyIcon,
  ExternalLinkIcon,
  FlagIcon,
  LinkIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  SparklesIcon,
  TimerIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { jiraBrowseUrl } from "@/lib/jira-browse";
import { selectableFixVersions } from "@/lib/fix-version-policy";
import {
  peekCanSetEpicLink,
  peekCanSetFixVersion,
  peekCanSetSprint,
  type PeekIssue,
} from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
  assign: "اختصاص",
  unassign: "بدون مسئول",
  log: "ثبت کار",
  timePh: "۱h ۳۰m",
  notePh: "توضیح…",
  submitLog: "ثبت",
  open: "باز کردن در جیرا",
  copyKey: "کپی کلید",
  refresh: "تازه‌سازی",
  rewrite: "بازنویسی با AI",
  more: "بیشتر",
  version: "ورژن",
  sprint: "اسپرینت",
  epic: "اپیک",
  status: "وضعیت",
  backlog: "بک‌لاگ",
  pickVersion: "ورژن",
  pickSprint: "اسپرینت",
  pickEpic: "اپیک",
  noneVersion: "بدون ورژن",
  noEpic: "بدون اپیک",
  transitionOk: "وضعیت به‌روز شد.",
  assignOk: "مسئول به‌روز شد.",
  logOk: "کار ثبت شد.",
  versionOk: "ورژن به‌روز شد.",
  sprintOk: "اسپرینت به‌روز شد.",
  epicOk: "لینک اپیک به‌روز شد.",
  copied: "کپی شد.",
  failed: "عملیات ناموفق.",
} as const;

type Props = {
  issue: PeekIssue;
  className?: string;
};

export function IssuePeekActions({ issue, className }: Props) {
  const {
    jiraUrl,
    jiraUsers,
    fetchJiraUsers,
    fetchingUsers,
    jiraVersions,
    fetchJiraVersions,
    jiraSprints,
    fetchJiraSprints,
    existingEpics,
    fetchExistingEpics,
    fetchingEpics,
  } = useJiraApp();
  const { refresh, patchIssue, setRewriteOpen } = useIssuePeek();

  const canVersion = peekCanSetFixVersion(issue);
  const canSprint = peekCanSetSprint(issue.issuetype);
  const canEpic = peekCanSetEpicLink(issue.issuetype);

  const [statuses, setStatuses] = useState<string[]>([]);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [sprintOpen, setSprintOpen] = useState(false);
  const [epicOpen, setEpicOpen] = useState(false);
  const [timeSpent, setTimeSpent] = useState("");
  const [note, setNote] = useState("");
  const [logging, setLogging] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [settingVersion, setSettingVersion] = useState(false);
  const [settingSprint, setSettingSprint] = useState(false);
  const [settingEpic, setSettingEpic] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/jira/issues/transitions?issueKey=${encodeURIComponent(issue.key)}`
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && Array.isArray(data.statuses)) {
          setStatuses(data.statuses.filter(Boolean));
        } else {
          setStatuses([]);
        }
      } catch {
        if (!cancelled) setStatuses([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [issue.key, issue.status]);

  useEffect(() => {
    if (assignOpen) void fetchJiraUsers();
  }, [assignOpen, fetchJiraUsers]);

  useEffect(() => {
    if (versionOpen && jiraVersions.length === 0) void fetchJiraVersions();
  }, [versionOpen, jiraVersions.length, fetchJiraVersions]);

  useEffect(() => {
    if (sprintOpen && jiraSprints.length === 0) void fetchJiraSprints();
  }, [sprintOpen, jiraSprints.length, fetchJiraSprints]);

  useEffect(() => {
    if (epicOpen && existingEpics.length === 0) void fetchExistingEpics();
  }, [epicOpen, existingEpics.length, fetchExistingEpics]);

  const userOptions = useMemo(
    () => [
      { value: "", label: t.unassign },
      ...jiraUsers.map((u) => ({
        value: u.name,
        label: u.displayName || u.name,
        sublabel: u.name,
        avatar: u.avatarUrls?.["24x24"] || u.avatarUrls?.["16x16"],
      })),
    ],
    [jiraUsers]
  );

  const versionOptions = useMemo(() => {
    const currentId =
      issue.selectedRelease || issue.fixVersionIds?.[0] || null;
    return selectableFixVersions(jiraVersions, { includeId: currentId }).map(
      (v) => ({
        value: v.id,
        label: v.name,
      })
    );
  }, [jiraVersions, issue.selectedRelease, issue.fixVersionIds]);

  const sprintOptions = useMemo(() => {
    const open = jiraSprints.filter((s) => s.state !== "closed");
    const ordered = [
      ...open.filter((s) => s.state === "active"),
      ...open.filter((s) => s.state === "future"),
    ];
    return [
      { value: "backlog", label: t.backlog },
      ...ordered.map((s) => ({
        value: String(s.id),
        label: s.name,
        sublabel: s.state,
      })),
    ];
  }, [jiraSprints]);

  const epicOptions = useMemo(
    () => [
      { value: "", label: t.noEpic },
      ...existingEpics.map((e) => ({
        value: e.key,
        label: e.key,
        sublabel: e.summary,
      })),
    ],
    [existingEpics]
  );

  const statusItems = useMemo(() => {
    const names = new Set(statuses);
    if (issue.status) names.add(issue.status);
    return Array.from(names).map((s) => ({ value: s, label: s }));
  }, [statuses, issue.status]);

  const versionLabel =
    issue.fixVersionNames?.[0] ||
    versionOptions.find((v) => v.value === issue.selectedRelease)?.label ||
    t.noneVersion;

  const sprintLabel =
    issue.sprintName ||
    jiraSprints.find((s) => String(s.id) === issue.selectedSprint)?.name ||
    (issue.selectedSprint ? issue.selectedSprint : t.backlog);

  const epicLabel = issue.epicKey || t.noEpic;
  const assigneeLabel =
    issue.assigneeDisplayName || issue.assignee || t.unassign;

  const transitionTo = async (statusName: string) => {
    if (busyStatus || statusName === issue.status) return;
    setBusyStatus(statusName);
    try {
      const res = await fetch("/api/jira/issues/transitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issueKey: issue.key, statusName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || t.failed);
      }
      patchIssue({ status: statusName });
      toast.success(t.transitionOk);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusyStatus(null);
    }
  };

  const assignTo = async (assignee: string) => {
    setAssigning(true);
    try {
      const res = await fetch("/api/jira/issues/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setAssignee",
          issueKeys: [issue.key],
          params: { assignee: assignee || null },
        }),
      });
      const data = await res.json().catch(() => ({}));
      const result = data.results?.[0];
      if (!res.ok || result?.success === false) {
        throw new Error(result?.error || data.error || t.failed);
      }
      const opt = userOptions.find((o) => o.value === assignee);
      patchIssue({
        assignee: assignee || "",
        assigneeDisplayName: assignee ? opt?.label || assignee : "",
      });
      toast.success(t.assignOk);
      setAssignOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setAssigning(false);
    }
  };

  const setVersion = async (fixVersionId: string) => {
    if (!fixVersionId) return;
    setSettingVersion(true);
    try {
      const res = await fetch("/api/jira/issues/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setFixVersion",
          issueKeys: [issue.key],
          params: { fixVersionId },
        }),
      });
      const data = await res.json().catch(() => ({}));
      const result = data.results?.[0];
      if (!res.ok || result?.success === false) {
        throw new Error(result?.error || data.error || t.failed);
      }
      const opt = versionOptions.find((o) => o.value === fixVersionId);
      patchIssue({
        selectedRelease: fixVersionId,
        fixVersionIds: [fixVersionId],
        fixVersionNames: opt ? [opt.label] : issue.fixVersionNames,
      });
      toast.success(t.versionOk);
      setVersionOpen(false);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSettingVersion(false);
    }
  };

  const setSprint = async (sprintIdOrBacklog: string) => {
    setSettingSprint(true);
    try {
      const toBacklog = sprintIdOrBacklog === "backlog" || !sprintIdOrBacklog;
      const sprintId = toBacklog ? "backlog" : sprintIdOrBacklog;
      const res = await fetch(
        `/api/jira/sprints/${encodeURIComponent(sprintId)}/move`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issues: [issue.key],
            target: toBacklog ? "backlog" : "sprint",
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || t.failed);
      }
      if (toBacklog) {
        patchIssue({ selectedSprint: undefined, sprintName: undefined });
      } else {
        const opt = sprintOptions.find((o) => o.value === sprintIdOrBacklog);
        patchIssue({
          selectedSprint: sprintIdOrBacklog,
          sprintName: opt?.label,
        });
      }
      toast.success(t.sprintOk);
      setSprintOpen(false);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSettingSprint(false);
    }
  };

  const setEpic = async (epicKey: string) => {
    setSettingEpic(true);
    try {
      const next = epicKey.trim() ? epicKey.trim().toUpperCase() : null;
      const res = await fetch("/api/jira/issues/epic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: issue.key,
          epicKey: next,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || t.failed);
      }
      if (next) {
        patchIssue({
          epicKey: next,
          selectedRelease: undefined,
          fixVersionIds: [],
          fixVersionNames: [],
        });
      } else {
        patchIssue({ epicKey: undefined });
      }
      toast.success(t.epicOk);
      setEpicOpen(false);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSettingEpic(false);
    }
  };

  const submitLog = async () => {
    if (!timeSpent.trim()) return;
    setLogging(true);
    try {
      const res = await fetch("/api/jira/worklog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issueKey: issue.key,
          timeSpent: timeSpent.trim(),
          comment: note.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || t.failed);
      }
      toast.success(t.logOk);
      setTimeSpent("");
      setNote("");
      setLogOpen(false);
      void refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setLogging(false);
    }
  };

  const propertyRows = (
    <div className="flex flex-col gap-1.5 text-xs">
      {canEpic ? (
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
          <span className="text-muted-foreground">{t.epic}</span>
          <Popover open={epicOpen} onOpenChange={setEpicOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 justify-start px-1.5 font-normal"
                />
              }
            >
              <LinkIcon data-icon="inline-start" className="size-3.5" />
              <span className="truncate font-mono">{epicLabel}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              {fetchingEpics && epicOptions.length <= 1 ? (
                <div className="flex justify-center py-3">
                  <Spinner />
                </div>
              ) : (
                <SearchableSelect
                  options={epicOptions}
                  value={issue.epicKey || ""}
                  onChange={(v) => void setEpic(v)}
                  disabled={settingEpic}
                  placeholder={t.pickEpic}
                />
              )}
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {canVersion ? (
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
          <span className="text-muted-foreground">{t.version}</span>
          <Popover open={versionOpen} onOpenChange={setVersionOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 justify-start px-1.5 font-normal"
                />
              }
            >
              <FlagIcon data-icon="inline-start" className="size-3.5" />
              <span className="truncate">{versionLabel}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <SearchableSelect
                options={versionOptions}
                value={issue.selectedRelease || issue.fixVersionIds?.[0] || ""}
                onChange={(v) => void setVersion(v)}
                disabled={settingVersion}
                placeholder={t.pickVersion}
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}

      {canSprint ? (
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
          <span className="text-muted-foreground">{t.sprint}</span>
          <Popover open={sprintOpen} onOpenChange={setSprintOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 justify-start px-1.5 font-normal"
                />
              }
            >
              <CalendarIcon data-icon="inline-start" className="size-3.5" />
              <span className="truncate">{sprintLabel}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <SearchableSelect
                options={sprintOptions}
                value={issue.selectedSprint || "backlog"}
                onChange={(v) => void setSprint(v)}
                disabled={settingSprint}
                placeholder={t.pickSprint}
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-2", className)} dir="rtl">
      <div className="flex flex-wrap items-center gap-1.5">
        {statusItems.length > 0 ? (
          <Select
            items={statusItems}
            value={issue.status || null}
            onValueChange={(v) => {
              if (v != null) void transitionTo(String(v));
            }}
            disabled={!!busyStatus}
          >
            <SelectTrigger size="sm" className="max-w-40" aria-label={t.status}>
              <SelectValue placeholder={t.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusItems.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}

        <Popover open={assignOpen} onOpenChange={setAssignOpen}>
          <PopoverTrigger
            render={
              <Button type="button" size="sm" variant="outline" />
            }
          >
            <UserIcon data-icon="inline-start" />
            <span className="max-w-28 truncate">{assigneeLabel}</span>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2">
            {fetchingUsers && userOptions.length <= 1 ? (
              <div className="flex justify-center py-3">
                <Spinner />
              </div>
            ) : (
              <SearchableSelect
                options={userOptions}
                value={issue.assignee || ""}
                onChange={(v) => void assignTo(v)}
                disabled={assigning}
                placeholder={t.assign}
              />
            )}
          </PopoverContent>
        </Popover>

        <Popover open={logOpen} onOpenChange={setLogOpen}>
          <PopoverTrigger
            render={
              <Button type="button" size="sm" variant="outline" />
            }
          >
            <TimerIcon data-icon="inline-start" />
            {t.log}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 gap-2 p-2">
            <Input
              value={timeSpent}
              onChange={(e) => setTimeSpent(e.target.value)}
              placeholder={t.timePh}
              spellCheck={false}
              aria-label={t.log}
            />
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.notePh}
              rows={2}
              className="min-h-16"
            />
            <Button
              type="button"
              size="sm"
              disabled={logging || !timeSpent.trim()}
              onClick={() => void submitLog()}
            >
              {logging ? <Spinner data-icon="inline-start" /> : null}
              {t.submitLog}
            </Button>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.open}
          title={t.open}
          render={
            <a
              href={jiraBrowseUrl(jiraUrl, issue.key)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <ExternalLinkIcon />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t.more}
                title={t.more}
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(issue.key);
                    toast.success(t.copied);
                  } catch {
                    toast.error(t.failed);
                  }
                }}
              >
                <CopyIcon />
                {t.copyKey}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={refreshing}
                onClick={async () => {
                  setRefreshing(true);
                  try {
                    await refresh();
                  } finally {
                    setRefreshing(false);
                  }
                }}
              >
                {refreshing ? <Spinner /> : <RefreshCwIcon />}
                {t.refresh}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRewriteOpen(true)}>
                <SparklesIcon />
                {t.rewrite}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {canEpic || canVersion || canSprint ? propertyRows : null}
    </div>
  );
}
