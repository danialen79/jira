"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarIcon,
  CopyIcon,
  ExternalLinkIcon,
  FlagIcon,
  LinkIcon,
  RefreshCwIcon,
  TimerIcon,
  UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const copy = {
  en: {
    assign: "Assign",
    unassign: "Unassigned",
    log: "Log work",
    timePh: "1h 30m",
    notePh: "Note…",
    submitLog: "Log",
    open: "Open in Jira",
    copyKey: "Copy key",
    refresh: "Refresh",
    version: "Version",
    sprint: "Sprint",
    epic: "Epic",
    backlog: "Backlog",
    pickVersion: "Fix version",
    pickSprint: "Sprint",
    pickEpic: "Epic",
    noneVersion: "No version",
    noEpic: "No epic",
    transitionOk: "Status updated.",
    assignOk: "Assignee updated.",
    logOk: "Work logged.",
    versionOk: "Version updated.",
    sprintOk: "Sprint updated.",
    epicOk: "Epic link updated.",
    copied: "Copied.",
    failed: "Action failed.",
  },
  fa: {
    assign: "اختصاص",
    unassign: "بدون مسئول",
    log: "ثبت کار",
    timePh: "۱h ۳۰m",
    notePh: "توضیح…",
    submitLog: "ثبت",
    open: "باز کردن در جیرا",
    copyKey: "کپی کلید",
    refresh: "تازه‌سازی",
    version: "ورژن",
    sprint: "اسپرینت",
    epic: "اپیک",
    backlog: "بک‌لاگ",
    pickVersion: "Fix version",
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
  },
} as const;

type Props = {
  issue: PeekIssue;
  className?: string;
};

export function IssuePeekActions({ issue, className }: Props) {
  const {
    language,
    isRtl,
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
  const t = copy[language];
  const { refresh, patchIssue } = useIssuePeek();

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
    [jiraUsers, t.unassign]
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
  }, [jiraSprints, t.backlog]);

  const epicOptions = useMemo(
    () => [
      { value: "", label: t.noEpic },
      ...existingEpics.map((e) => ({
        value: e.key,
        label: e.key,
        sublabel: e.summary,
      })),
    ],
    [existingEpics, t.noEpic]
  );

  const versionLabel =
    issue.fixVersionNames?.[0] ||
    versionOptions.find((v) => v.value === issue.selectedRelease)?.label ||
    t.noneVersion;

  const sprintLabel =
    issue.sprintName ||
    jiraSprints.find((s) => String(s.id) === issue.selectedSprint)?.name ||
    (issue.selectedSprint ? issue.selectedSprint : t.backlog);

  const epicLabel = issue.epicKey || t.noEpic;

  const transitionTo = async (statusName: string) => {
    if (busyStatus) return;
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
      const sprintId = toBacklog
        ? "backlog"
        : sprintIdOrBacklog;
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
          language,
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

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {statuses.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {statuses.map((s) => {
            const active = s.toLowerCase() === issue.status.toLowerCase();
            return (
              <button
                key={s}
                type="button"
                disabled={!!busyStatus || active}
                onClick={() => void transitionTo(s)}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted",
                  busyStatus === s && "opacity-60"
                )}
              >
                {busyStatus === s ? <Spinner className="size-3" /> : s}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1">
        <Popover open={assignOpen} onOpenChange={setAssignOpen}>
          <PopoverTrigger
            render={
              <Button type="button" size="sm" variant="outline" />
            }
          >
            <UserIcon data-icon="inline-start" />
            {t.assign}
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
                isRtl={isRtl}
                disabled={assigning}
                placeholder={t.assign}
              />
            )}
          </PopoverContent>
        </Popover>

        {canEpic ? (
          <Popover open={epicOpen} onOpenChange={setEpicOpen}>
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant="outline" />
              }
            >
              <LinkIcon data-icon="inline-start" />
              <span className="max-w-24 truncate font-mono">{epicLabel}</span>
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
                  isRtl={isRtl}
                  disabled={settingEpic}
                  placeholder={t.pickEpic}
                />
              )}
            </PopoverContent>
          </Popover>
        ) : null}

        {canVersion ? (
          <Popover open={versionOpen} onOpenChange={setVersionOpen}>
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant="outline" />
              }
            >
              <FlagIcon data-icon="inline-start" />
              <span className="max-w-24 truncate">{versionLabel}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <SearchableSelect
                options={versionOptions}
                value={issue.selectedRelease || issue.fixVersionIds?.[0] || ""}
                onChange={(v) => void setVersion(v)}
                isRtl={isRtl}
                disabled={settingVersion}
                placeholder={t.pickVersion}
              />
            </PopoverContent>
          </Popover>
        ) : null}

        {canSprint ? (
          <Popover open={sprintOpen} onOpenChange={setSprintOpen}>
            <PopoverTrigger
              render={
                <Button type="button" size="sm" variant="outline" />
              }
            >
              <CalendarIcon data-icon="inline-start" />
              <span className="max-w-24 truncate">{sprintLabel}</span>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2">
              <SearchableSelect
                options={sprintOptions}
                value={issue.selectedSprint || "backlog"}
                onChange={(v) => void setSprint(v)}
                isRtl={isRtl}
                disabled={settingSprint}
                placeholder={t.pickSprint}
              />
            </PopoverContent>
          </Popover>
        ) : null}

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
              aria-label={t.timePh}
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

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.copyKey}
          title={t.copyKey}
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
        </Button>

        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label={t.refresh}
          title={t.refresh}
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
        </Button>

        <Badge variant="secondary" className="ms-auto font-normal">
          {issue.assigneeDisplayName || issue.assignee || t.unassign}
        </Badge>
      </div>
    </div>
  );
}
