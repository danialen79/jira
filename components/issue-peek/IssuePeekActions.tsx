"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CopyIcon,
  ExternalLinkIcon,
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
import type { PeekIssue } from "@/lib/issue-peek";
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
    transitionOk: "Status updated.",
    assignOk: "Assignee updated.",
    logOk: "Work logged.",
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
    transitionOk: "وضعیت به‌روز شد.",
    assignOk: "مسئول به‌روز شد.",
    logOk: "کار ثبت شد.",
    copied: "کپی شد.",
    failed: "عملیات ناموفق.",
  },
} as const;

type Props = {
  issue: PeekIssue;
  className?: string;
};

export function IssuePeekActions({ issue, className }: Props) {
  const { language, isRtl, jiraUrl, jiraUsers, fetchJiraUsers, fetchingUsers } =
    useJiraApp();
  const t = copy[language];
  const { refresh, patchIssue } = useIssuePeek();

  const [statuses, setStatuses] = useState<string[]>([]);
  const [busyStatus, setBusyStatus] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [timeSpent, setTimeSpent] = useState("");
  const [note, setNote] = useState("");
  const [logging, setLogging] = useState(false);
  const [assigning, setAssigning] = useState(false);
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
