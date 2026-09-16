"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";
import FilterBar from "@/components/issue-ops/FilterBar";
import IssueList from "@/components/issue-ops/IssueList";
import BulkActionBar from "@/components/issue-ops/BulkActionBar";
import OpsIssueEditDialog from "@/components/issue-ops/OpsIssueEditDialog";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useIssueOpsQuery } from "@/hooks/use-issue-ops-query";
import { useIssueSelection } from "@/hooks/use-issue-selection";
import { isBacklogExcludedStatus } from "@/lib/issue-ops/backlog";
import { parseOpsFilters } from "@/lib/issue-ops/filters";
import type { OpsFilterValues } from "@/lib/issue-ops/types";
import type { OpsIssue } from "@/lib/issue-ops/types";
import { useUrlQueryState } from "@/lib/url-state";

const PAGE_SIZE = 50;

const copy = {
  en: {
    connectTitle: "Connect Jira",
    connectHint: "Configure Jira in Settings, then refresh.",
    refresh: "Refresh",
    prev: "Previous",
    next: "Next",
    of: "of",
  },
  fa: {
    connectTitle: "اتصال جیرا",
    connectHint: "در تنظیمات جیرا را پیکربندی کنید، سپس تازه کنید.",
    refresh: "تازه‌سازی",
    prev: "قبلی",
    next: "بعدی",
    of: "از",
  },
} as const;

function chipUrlValue(value: string): string | null {
  // Default is on ("1"); only persist when off so URL stays short.
  return value === "0" ? "0" : null;
}

export default function IssueOpsBoard() {
  const {
    language,
    isRtl,
    jiraConnected,
    jiraUsers,
    jiraVersions,
    fetchJiraUsers,
    fetchJiraVersions,
  } = useJiraApp();
  const t = copy[language];
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<OpsFilterValues>(() =>
    parseOpsFilters(searchParams)
  );
  const [startAt, setStartAt] = useState(0);
  const [editIssue, setEditIssue] = useState<OpsIssue | null>(null);

  useUrlQueryState(
    {
      rel: chipUrlValue(filters.missRelease),
      asn: chipUrlValue(filters.missAssign),
      lens: chipUrlValue(filters.missLens),
      cmp: chipUrlValue(filters.missComponent),
      asg: filters.assignee.trim() || null,
      type: filters.type === "ALL" ? null : filters.type,
      status: filters.status === "ALL" ? null : filters.status,
      q: filters.q.trim() || null,
    },
    {
      rel: null,
      asn: null,
      lens: null,
      cmp: null,
      asg: null,
      type: null,
      status: null,
      q: null,
    }
  );

  const { issues, total, loading, error, refresh } = useIssueOpsQuery(
    filters,
    startAt,
    PAGE_SIZE,
    jiraConnected
  );
  const selection = useIssueSelection();

  useEffect(() => {
    if (!jiraConnected) return;
    if (jiraUsers.length === 0) void fetchJiraUsers();
    if (jiraVersions.length === 0) void fetchJiraVersions();
  }, [
    jiraConnected,
    jiraUsers.length,
    jiraVersions.length,
    fetchJiraUsers,
    fetchJiraVersions,
  ]);

  const statusOptions = useMemo(() => {
    const set = new Set(issues.map((i) => i.status).filter(Boolean));
    if (filters.status !== "ALL") set.add(filters.status);
    return Array.from(set)
      .filter((s) => !isBacklogExcludedStatus(s))
      .sort();
  }, [issues, filters.status]);

  const patchFilters = (patch: Partial<OpsFilterValues>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setStartAt(0);
    selection.clear();
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageIndex = Math.floor(startAt / PAGE_SIZE) + 1;

  if (!jiraConnected) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t.connectTitle}</EmptyTitle>
          <EmptyDescription>{t.connectHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <FilterBar
            language={language}
            isRtl={isRtl}
            values={filters}
            statusOptions={statusOptions}
            users={jiraUsers}
            onChange={patchFilters}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refresh()}
          disabled={loading}
        >
          <RefreshCwIcon data-icon="inline-start" />
          {t.refresh}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <IssueList
        language={language}
        isRtl={isRtl}
        issues={issues}
        loading={loading}
        selectedKeys={selection.selected}
        onToggle={selection.toggle}
        onTogglePage={() => selection.togglePage(issues.map((i) => i.key))}
        onEdit={setEditIssue}
      />

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="tabular-nums text-muted-foreground">
            {pageIndex} {t.of} {pageCount} ({total})
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={startAt <= 0 || loading}
              onClick={() => setStartAt((s) => Math.max(0, s - PAGE_SIZE))}
            >
              {t.prev}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={startAt + PAGE_SIZE >= total || loading}
              onClick={() => setStartAt((s) => s + PAGE_SIZE)}
            >
              {t.next}
            </Button>
          </div>
        </div>
      )}

      {/* Keep list clear of the fixed bulk bar */}
      {selection.count > 0 ? <div className="h-40 shrink-0" aria-hidden /> : null}

      <BulkActionBar
        language={language}
        isRtl={isRtl}
        count={selection.count}
        selectedKeys={selection.selectedKeys}
        users={jiraUsers}
        versions={jiraVersions}
        statusOptions={statusOptions}
        onClear={selection.clear}
        onDone={refresh}
      />

      <OpsIssueEditDialog
        open={!!editIssue}
        onOpenChange={(open) => {
          if (!open) setEditIssue(null);
        }}
        issue={editIssue}
        versions={jiraVersions}
        users={jiraUsers}
        language={language}
        isRtl={isRtl}
        onSaved={refresh}
      />
    </div>
  );
}
