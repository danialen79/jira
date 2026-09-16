"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ClipboardList,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { JiraUser } from "@/lib/types";
import { getSearchParam, useUrlQueryState } from "@/lib/url-state";
import {
  buildKanbanColumns,
  moveIssueStatus,
  rollupBoardIssues,
} from "@/lib/daily-board/rollup";
import type {
  BoardColumnDef,
  DailyBoardIssue,
  RecentLogItem,
  WorklogChip,
} from "@/lib/daily-board/types";
import KanbanBoard from "@/components/daily-board/KanbanBoard";
import WorklogDock from "@/components/daily-board/WorklogDock";
import SearchableSelect from "@/components/SearchableSelect";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

interface MyDailyBoardProps {  jiraUrl: string;
  jiraUsername: string;
  jiraConnected: boolean;
  jiraUsers: JiraUser[];
}

const translations = {
    subtitle: "کانبان کارهای شما. وضعیت را بکشید؛ کارکرد را از نوار پایین ثبت کنید.",
    loadError: "بارگذاری ایشوها ناموفق. اتصال جیرا را بررسی کنید.",
    notConnected: "جیرا متصل نیست",
    notConnectedDesc: "در تنظیمات وصل شوید، بعد تازه‌سازی.",
    refreshBtn: "تازه‌سازی",
    loadingIssues: "در حال بارگذاری…",
    searchPlaceholder: "جستجوی کلید یا خلاصه…",
    allUsersOption: "همه مسئولان",
    targetUserLabel: "مسئول",
    searchUserPlaceholder: "جستجوی کاربر…",
    noIssuesFound: "ایشویی با این فیلترها نیست.",
    noTicketsFound: "ایشویی نیست",
    jiraSystemError: "خطای جیرا",
    moveFailed: "جابه‌جایی ایشو ناموفق بود.",
    addedToLog: "به نوار کارکرد اضافه شد",
    boardFrom: "بورد",
  };

export default function MyDailyBoard({  jiraUrl,
  jiraUsername,
  jiraConnected,
  jiraUsers,
}: MyDailyBoardProps) {
  const t = translations;
  const isRtl = true;
  const searchParams = useSearchParams();
  const urlAssignee = searchParams.get("assignee");
  const assigneeFromUrl = useRef(!!urlAssignee);

  const [loading, setLoading] = useState(false);
  const [issues, setIssues] = useState<DailyBoardIssue[]>([]);
  const [boardColumns, setBoardColumns] = useState<BoardColumnDef[] | null>(
    null
  );
  const [boardLabel, setBoardLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState(
    getSearchParam(searchParams, "q")
  );
  const [selectedAssignee, setSelectedAssignee] = useState<string>(
    urlAssignee || "ALL"
  );

  useUrlQueryState({
    q: searchQuery || null,
    assignee: selectedAssignee === "ALL" ? null : selectedAssignee,
  });

  const [chips, setChips] = useState<WorklogChip[]>([]);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [recentLogs, setRecentLogs] = useState<RecentLogItem[]>([]);

  useEffect(() => {
    if (assigneeFromUrl.current) return;
    if (jiraUsers && jiraUsers.length > 0) {
      const cleanUsername = (jiraUsername || "").trim().toLowerCase();
      if (cleanUsername) {
        const match = jiraUsers.find(
          (u) =>
            u.name.toLowerCase() === cleanUsername ||
            (u.emailAddress && u.emailAddress.toLowerCase() === cleanUsername)
        );
        if (match) {
          setSelectedAssignee(match.name);
          return;
        }
      }
      setSelectedAssignee(jiraUsers[0].name);
    } else if (jiraUsername) {
      setSelectedAssignee(jiraUsername);
    } else {
      setSelectedAssignee("ALL");
    }
  }, [jiraUsers, jiraUsername]);

  const matchesSelectedAssignee = useCallback(
    (issue: DailyBoardIssue, targetUsername: string) => {
      if (!targetUsername || targetUsername === "ALL") return true;

      const cleanTarget = targetUsername.trim().toLowerCase();
      const targetPrefix = cleanTarget.includes("@")
        ? cleanTarget.split("@")[0]
        : cleanTarget;

      const issueAssignee = (issue.assignee || "").trim().toLowerCase();
      const issueAssigneeEmail = (issue.assigneeEmail || "").trim().toLowerCase();
      const issueAssigneeKey = (issue.assigneeKey || "").trim().toLowerCase();
      const issueAssigneeDisplayName = (issue.assigneeDisplayName || "")
        .trim()
        .toLowerCase();

      const targetUserObj = jiraUsers.find(
        (u) => u.name.toLowerCase() === cleanTarget
      );
      const targetDisplayName = targetUserObj
        ? targetUserObj.displayName.trim().toLowerCase()
        : "";
      const targetEmail =
        targetUserObj && targetUserObj.emailAddress
          ? targetUserObj.emailAddress.trim().toLowerCase()
          : "";

      if (
        issueAssignee === cleanTarget ||
        issueAssigneeKey === cleanTarget ||
        issueAssigneeEmail === cleanTarget ||
        (issueAssignee && issueAssignee === targetPrefix) ||
        (issueAssigneeKey && issueAssigneeKey === targetPrefix) ||
        (issueAssigneeEmail &&
          issueAssigneeEmail.split("@")[0] === targetPrefix) ||
        (issueAssignee &&
          (issueAssignee.includes(targetPrefix) ||
            targetPrefix.includes(issueAssignee)) &&
          issueAssignee.length > 3 &&
          targetPrefix.length > 3)
      ) {
        return true;
      }

      if (targetDisplayName && issueAssigneeDisplayName) {
        if (
          issueAssigneeDisplayName === targetDisplayName ||
          issueAssigneeDisplayName.includes(targetDisplayName) ||
          targetDisplayName.includes(issueAssigneeDisplayName)
        ) {
          return true;
        }
      }

      if (targetEmail && issueAssigneeEmail) {
        if (
          issueAssigneeEmail === targetEmail ||
          issueAssigneeEmail.split("@")[0] === targetEmail.split("@")[0]
        ) {
          return true;
        }
      }

      return false;
    },
    [jiraUsers]
  );

  const isConnected = jiraConnected && !!jiraUrl;

  const fetchIssues = useCallback(async () => {
    if (!isConnected) return;
    setLoading(true);
    setError(null);
    try {
      const assigneeQs =
        selectedAssignee && selectedAssignee !== "ALL"
          ? `?assignee=${encodeURIComponent(selectedAssignee)}`
          : "?assignee=ALL";
      const [issuesRes, colsRes] = await Promise.all([
        fetch(`/api/jira/my-issues${assigneeQs}`),
        fetch("/api/jira/board-columns"),
      ]);
      const issuesData = await issuesRes.json();
      if (issuesRes.ok && issuesData.success) {
        setIssues(
          (issuesData.issues || []).map((i: DailyBoardIssue) => ({
            ...i,
            statusCategory: i.statusCategory || "new",
          }))
        );
      } else {
        setError(issuesData.error || t.loadError);
      }

      if (colsRes.ok) {
        const colsData = await colsRes.json();
        if (colsData.success && Array.isArray(colsData.columns)) {
          setBoardColumns(colsData.columns);
          setBoardLabel(
            colsData.board?.name ? `${colsData.board.name}` : null
          );
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.loadError);
    } finally {
      setLoading(false);
    }
  }, [isConnected, selectedAssignee, t.loadError]);

  const fetchRecentLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/recent-logs");
      if (!res.ok) return;
      const data = await res.json();
      setRecentLogs(
        (data.logs || []).map((log: RecentLogItem) => ({
          issueKey: log.issueKey,
          summary: log.summary,
          parentKey: log.parentKey,
          timeSpent: log.timeSpent,
          comment: log.comment,
          timestamp: log.timestamp,
          url: log.url,
        }))
      );
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isConnected) fetchIssues();
  }, [isConnected, fetchIssues]);

  useEffect(() => {
    void fetchRecentLogs();
  }, [fetchRecentLogs]);

  const assigneeOptions = useMemo(
    () => [
      { value: "ALL", label: t.allUsersOption },
      ...jiraUsers.map((u) => ({
        value: u.name,
        label: u.displayName,
        sublabel: u.name,
      })),
    ],
    [jiraUsers, t.allUsersOption]
  );

  const boardIssues = useMemo(() => {
    const rolled = rollupBoardIssues(issues, (issue) =>
      matchesSelectedAssignee(issue, selectedAssignee)
    );
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rolled;
    return rolled.filter(
      (issue) =>
        (issue.key || "").toLowerCase().includes(q) ||
        (issue.summary || "").toLowerCase().includes(q)
    );
  }, [issues, matchesSelectedAssignee, selectedAssignee, searchQuery]);

  const columns = useMemo(
    () => buildKanbanColumns(boardIssues, boardColumns),
    [boardIssues, boardColumns]
  );

  const chipIssues = useMemo(() => {
    const byKey = new Map(issues.map((i) => [i.key, i]));
    return chips
      .map((c) => byKey.get(c.key))
      .filter((i): i is DailyBoardIssue => !!i);
  }, [chips, issues]);

  const handleAddToLog = useCallback(
    (issue: DailyBoardIssue) => {
      setChips((prev) => {
        if (prev.some((c) => c.key === issue.key)) return prev;
        return [...prev, { key: issue.key, summary: issue.summary }];
      });
      setFocusedKey(issue.key);
      toast.success(`${t.addedToLog}: ${issue.key}`);
    },
    [t.addedToLog]
  );

  const handleStatusChange = useCallback(
    async (issueKey: string, jiraStatusName: string) => {
      const prev = issues;
      const targetCol = columns.find(
        (c) =>
          c.dropStatusName === jiraStatusName ||
          c.statusNames.some(
            (n) => n.toLowerCase() === jiraStatusName.toLowerCase()
          )
      );
      setIssues((curr) =>
        moveIssueStatus(
          curr,
          issueKey,
          jiraStatusName,
          targetCol?.category
        )
      );
      try {
        const res = await fetch("/api/jira/issues/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "setStatus",
            issueKeys: [issueKey],
            params: { statusName: jiraStatusName },
          }),
        });
        const data = await res.json();
        const result = data.results?.[0];
        if (!res.ok || !data.success || result?.success === false) {
          throw new Error(result?.error || data.error || t.moveFailed);
        }
      } catch (err) {
        setIssues(prev);
        toast.error(err instanceof Error ? err.message : t.moveFailed);
      }
    },
    [issues, columns, t.moveFailed]
  );

  if (!isConnected) {
    return (
      <Empty className="mx-auto max-w-xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertCircle className="text-warning" />
          </EmptyMedia>
          <EmptyTitle>{t.notConnected}</EmptyTitle>
          <EmptyDescription>{t.notConnectedDesc}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-28 sm:pb-32">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
          {boardLabel ? (
            <p className="text-xs text-muted-foreground">
              {t.boardFrom}: <span className="font-medium text-foreground">{boardLabel}</span>
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchIssues}
          disabled={loading}
          className="self-start sm:self-auto"
        >
          {loading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          {t.refreshBtn}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
          />
        </InputGroup>

        <div className="flex w-full items-center gap-2 sm:w-72">
          <User className="size-4 shrink-0 text-muted-foreground" />
          <SearchableSelect
            options={assigneeOptions}
            value={selectedAssignee}
            onChange={setSelectedAssignee}
            placeholder={t.searchUserPlaceholder}
            />
        </div>

        <Badge variant="secondary" className="shrink-0 self-start sm:self-auto">
          {selectedAssignee === "ALL"
            ? t.allUsersOption
            : jiraUsers.find((u) => u.name === selectedAssignee)?.displayName ||
              selectedAssignee}
        </Badge>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t.jiraSystemError}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && issues.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Spinner />
          {t.loadingIssues}
        </div>
      ) : columns.length === 0 ? (
        <Empty className="border border-dashed py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>{t.noTicketsFound}</EmptyTitle>
            <EmptyDescription>{t.noIssuesFound}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <KanbanBoard
          columns={columns}
          jiraUrl={jiraUrl}
          onStatusChange={handleStatusChange}
          onAddToLog={handleAddToLog}
        />
      )}

      <WorklogDock
        jiraUrl={jiraUrl}
        chips={chips}
        focusedKey={focusedKey}
        onFocusChip={setFocusedKey}
        onRemoveChip={(key) => {
          setChips((prev) => prev.filter((c) => c.key !== key));
          setFocusedKey((fk) => (fk === key ? null : fk));
        }}
        onClearChips={() => {
          setChips([]);
          setFocusedKey(null);
        }}
        chipIssues={chipIssues}
        recentLogs={recentLogs}
        onLogged={() => {
          void fetchIssues();
          void fetchRecentLogs();
        }}
      />
    </div>
  );
}
