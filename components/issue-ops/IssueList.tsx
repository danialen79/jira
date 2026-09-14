"use client";

import { useState } from "react";
import { PencilIcon, Tag, User } from "lucide-react";
import { toast } from "sonner";
import {
  IssueCard,
  IssueCardChildren,
  IssueCardFooter,
  IssueCardHeader,
  IssueKeyLink,
} from "@/components/issue-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { canHaveSubtasks } from "@/lib/issue-ops/map";
import type { OpsIssue } from "@/lib/issue-ops/types";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { jiraBrowseUrl, normalizeJiraBase } from "@/lib/jira-browse";
import { lensDisplayLabel } from "@/lib/lens";
import type { Language } from "@/lib/types";

const copy = {
  en: {
    empty: "No issues match",
    emptyHint: "Relax filters or clear search.",
    viaEpic: "via",
    unassigned: "Unassigned",
    selectAll: "Select page",
    edit: "Edit",
    noSubtasks: "No sub-tasks",
    loadSubtasksFailed: "Could not load sub-tasks.",
  },
  fa: {
    empty: "ایشویی نیست",
    emptyHint: "فیلتر را کم کنید یا جستجو را پاک کنید.",
    viaEpic: "از",
    unassigned: "بدون مسئول",
    selectAll: "انتخاب صفحه",
    edit: "ویرایش",
    noSubtasks: "ساب‌تسکی نیست",
    loadSubtasksFailed: "بارگذاری ساب‌تسک‌ها نشد.",
  },
} as const;

type Props = {
  language: Language;
  isRtl: boolean;
  issues: OpsIssue[];
  loading: boolean;
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onTogglePage: () => void;
  onEdit: (issue: OpsIssue) => void;
};

function OpsIssueBadges({
  issue,
  language,
  jiraBase,
}: {
  issue: OpsIssue;
  language: Language;
  jiraBase: string;
}) {
  return (
    <>
      <IssueKeyLink
        href={jiraBrowseUrl(jiraBase, issue.key)}
        issueKey={issue.key}
      />
      <Badge className={getIssueTypeBadgeClass(issue.issuetype)}>
        {issue.issuetype}
      </Badge>
      <IssueStatusBadge
        status={issue.status}
        statusCategoryKey={issue.statusCategoryKey}
      />
      {issue.lens ? (
        <Badge variant="outline">
          {lensDisplayLabel(issue.lens, language)}
        </Badge>
      ) : null}
    </>
  );
}

function OpsIssueRow({
  issue,
  language,
  jiraBase,
  nested,
  selectedKeys,
  onToggle,
  onEdit,
  t,
}: {
  issue: OpsIssue;
  language: Language;
  jiraBase: string;
  nested?: boolean;
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (issue: OpsIssue) => void;
  t: (typeof copy)[Language];
}) {
  const checked = selectedKeys.has(issue.key);
  const versionLabel = issue.effectiveFixVersionName
    ? issue.effectiveFixVersionFromEpic && issue.epicKey
      ? `${issue.effectiveFixVersionName} (${t.viaEpic} ${issue.epicKey})`
      : issue.effectiveFixVersionName
    : null;

  return (
    <IssueCard nested={nested}>
      <IssueCardHeader
        title={issue.summary}
        leading={
          <Checkbox
            checked={checked}
            onCheckedChange={() => onToggle(issue.key)}
            aria-label={issue.key}
          />
        }
        badges={
          <OpsIssueBadges
            issue={issue}
            language={language}
            jiraBase={jiraBase}
          />
        }
      />
      <IssueCardFooter
        meta={[
          {
            icon: User,
            label:
              issue.assigneeDisplayName || issue.assignee || t.unassigned,
            key: "assignee",
          },
          ...(versionLabel
            ? [{ icon: Tag, label: versionLabel, key: "version" as const }]
            : []),
        ]}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={t.edit}
            onClick={() => onEdit(issue)}
          >
            <PencilIcon data-icon="inline-start" />
            {t.edit}
          </Button>
        }
      />
    </IssueCard>
  );
}

export default function IssueList({
  language,
  isRtl,
  issues,
  loading,
  selectedKeys,
  onToggle,
  onTogglePage,
  onEdit,
}: Props) {
  const t = copy[language];
  const { jiraUrl } = useJiraApp();
  const jiraBase = normalizeJiraBase(jiraUrl);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [subtasksByParent, setSubtasksByParent] = useState<
    Record<string, OpsIssue[]>
  >({});
  const [loadingParents, setLoadingParents] = useState<Set<string>>(new Set());

  const pageKeys = issues.map((i) => i.key);
  const allSelected =
    pageKeys.length > 0 && pageKeys.every((k) => selectedKeys.has(k));

  const loadSubtasks = async (parent: OpsIssue) => {
    const key = parent.key;
    if (subtasksByParent[key]) return;
    setLoadingParents((prev) => new Set(prev).add(key));
    try {
      const res = await fetch(
        `/api/jira/issues/subtasks?parentKey=${encodeURIComponent(key)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || t.loadSubtasksFailed);
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }
      setSubtasksByParent((prev) => ({
        ...prev,
        [key]: data.issues || [],
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.loadSubtasksFailed);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } finally {
      setLoadingParents((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleOpenChange = (issue: OpsIssue, open: boolean) => {
    const key = issue.key;
    if (!open) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    setExpanded((prev) => new Set(prev).add(key));
    void loadSubtasks(issue);
  };

  if (loading && issues.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!loading && issues.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>{t.empty}</EmptyTitle>
          <EmptyDescription>{t.emptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => onTogglePage()}
          aria-label={t.selectAll}
        />
        <span className="text-xs text-muted-foreground">{t.selectAll}</span>
      </div>

      <ul className="flex flex-col gap-2">
        {issues.map((issue) => {
          const showSubs = canHaveSubtasks(issue.issuetype);
          const isOpen = expanded.has(issue.key);
          const kids = subtasksByParent[issue.key];
          const kidsLoading = loadingParents.has(issue.key);
          const versionLabel = issue.effectiveFixVersionName
            ? issue.effectiveFixVersionFromEpic && issue.epicKey
              ? `${issue.effectiveFixVersionName} (${t.viaEpic} ${issue.epicKey})`
              : issue.effectiveFixVersionName
            : null;

          return (
            <li key={issue.key}>
              <IssueCard
                collapsible={showSubs}
                expandable={showSubs}
                open={isOpen}
                onOpenChange={(open) => handleOpenChange(issue, open)}
              >
                <IssueCardHeader
                  title={issue.summary}
                  leading={
                    <Checkbox
                      checked={selectedKeys.has(issue.key)}
                      onCheckedChange={() => onToggle(issue.key)}
                      aria-label={issue.key}
                    />
                  }
                  badges={
                    <OpsIssueBadges
                      issue={issue}
                      language={language}
                      jiraBase={jiraBase}
                    />
                  }
                />
                <IssueCardFooter
                  meta={[
                    {
                      icon: User,
                      label:
                        issue.assigneeDisplayName ||
                        issue.assignee ||
                        t.unassigned,
                      key: "assignee",
                    },
                    ...(versionLabel
                      ? [
                          {
                            icon: Tag,
                            label: versionLabel,
                            key: "version" as const,
                          },
                        ]
                      : []),
                  ]}
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t.edit}
                      onClick={() => onEdit(issue)}
                    >
                      <PencilIcon data-icon="inline-start" />
                      {t.edit}
                    </Button>
                  }
                />
                {showSubs ? (
                  <IssueCardChildren>
                    {kidsLoading && !kids ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Spinner />
                      </div>
                    ) : null}
                    {!kidsLoading && kids && kids.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        {t.noSubtasks}
                      </p>
                    ) : null}
                    {(kids || []).map((child) => (
                      <OpsIssueRow
                        key={child.key}
                        issue={child}
                        language={language}
                        jiraBase={jiraBase}
                        nested
                        selectedKeys={selectedKeys}
                        onToggle={onToggle}
                        onEdit={onEdit}
                        t={t}
                      />
                    ))}
                  </IssueCardChildren>
                ) : null}
              </IssueCard>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
