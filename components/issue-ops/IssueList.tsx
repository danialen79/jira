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
import { isEpicIssueType } from "@/lib/fix-version-policy";
import type { VersionIssue } from "@/lib/types";

const issueListText = {
    empty: "بک‌لاگی نیست",
    emptyHint: "یک چیپ ناقص را خاموش کنید یا جستجو را پاک کنید.",
    viaEpic: "از",
    unassigned: "بدون مسئول",
    selectAll: "انتخاب صفحه",
    edit: "ویرایش",
    noSubtasks: "ساب‌تسکی نیست",
    noChildren: "فرزندی نیست",
    loadSubtasksFailed: "بارگذاری ساب‌تسک‌ها نشد.",
    loadChildrenFailed: "بارگذاری فرزندان اپیک نشد.",
  } as const;

type Props = {
  issues: OpsIssue[];
  loading: boolean;
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onTogglePage: () => void;
  onEdit: (issue: OpsIssue) => void;
};

function versionIssueToOpsIssue(raw: VersionIssue): OpsIssue {
  return {
    key: raw.key,
    id: raw.id,
    summary: raw.summary,
    issuetype: raw.issuetype,
    status: raw.status,
    statusCategoryKey: raw.statusCategoryKey,
    priority: raw.priority,
    assignee: raw.assignee,
    assigneeDisplayName: raw.assigneeDisplayName,
    components: raw.components || [],
    lens: raw.lens,
    epicKey: raw.epicKey,
    parentKey: raw.parentKey,
    isSubtask: false,
    fixVersionIds: [],
    fixVersionNames: [],
    ownsFixVersion: false,
  };
}

function canExpand(issuetype: string): boolean {
  return isEpicIssueType(issuetype) || canHaveSubtasks(issuetype);
}

function OpsIssueBadges({
  issue,
  jiraBase,
}: {
  issue: OpsIssue;
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
          {lensDisplayLabel(issue.lens)}
        </Badge>
      ) : null}
    </>
  );
}

function OpsIssueRow({
  issue,
  jiraBase,
  nested,
  selectedKeys,
  onToggle,
  onEdit,
}: {
  issue: OpsIssue;
  jiraBase: string;
  nested?: boolean;
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onEdit: (issue: OpsIssue) => void;
}) {
  const checked = selectedKeys.has(issue.key);
  const versionLabel = issue.effectiveFixVersionName
    ? issue.effectiveFixVersionFromEpic && issue.epicKey
      ? `${issue.effectiveFixVersionName} (${issueListText.viaEpic} ${issue.epicKey})`
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
            jiraBase={jiraBase}
          />
        }
      />
      <IssueCardFooter
        meta={[
          {
            icon: User,
            label:
              issue.assigneeDisplayName || issue.assignee || issueListText.unassigned,
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
            aria-label={issueListText.edit}
            onClick={() => onEdit(issue)}
          >
            <PencilIcon data-icon="inline-start" />
            {issueListText.edit}
          </Button>
        }
      />
    </IssueCard>
  );
}

export default function IssueList({
  issues,
  loading,
  selectedKeys,
  onToggle,
  onTogglePage,
  onEdit,
}: Props) {
  const { jiraUrl } = useJiraApp();
  const jiraBase = normalizeJiraBase(jiraUrl);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [childrenByParent, setChildrenByParent] = useState<
    Record<string, OpsIssue[]>
  >({});
  const [loadingParents, setLoadingParents] = useState<Set<string>>(new Set());

  const pageKeys = issues.map((i) => i.key);
  const allSelected =
    pageKeys.length > 0 && pageKeys.every((k) => selectedKeys.has(k));

  const loadChildren = async (parent: OpsIssue) => {
    const key = parent.key;
    if (childrenByParent[key]) return;
    setLoadingParents((prev) => new Set(prev).add(key));
    const isEpic = isEpicIssueType(parent.issuetype);
    try {
      const res = await fetch(
        isEpic
          ? `/api/jira/issues/epic-children?epicKey=${encodeURIComponent(key)}`
          : `/api/jira/issues/subtasks?parentKey=${encodeURIComponent(key)}`
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(
          data.error ||
            (isEpic ? issueListText.loadChildrenFailed : issueListText.loadSubtasksFailed)
        );
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        return;
      }
      const kids: OpsIssue[] = isEpic
        ? ((data.issues || []) as VersionIssue[]).map(versionIssueToOpsIssue)
        : (data.issues as OpsIssue[]) || [];
      setChildrenByParent((prev) => ({
        ...prev,
        [key]: kids,
      }));
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : isEpic
            ? issueListText.loadChildrenFailed
            : issueListText.loadSubtasksFailed
      );
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
    void loadChildren(issue);
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
          <EmptyTitle>{issueListText.empty}</EmptyTitle>
          <EmptyDescription>{issueListText.emptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-2" dir="rtl">
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => onTogglePage()}
          aria-label={issueListText.selectAll}
        />
        <span className="text-xs text-muted-foreground">{issueListText.selectAll}</span>
      </div>

      <ul className="flex flex-col gap-2">
        {issues.map((issue) => {
          const expandable = canExpand(issue.issuetype);
          const isEpic = isEpicIssueType(issue.issuetype);
          const isOpen = expanded.has(issue.key);
          const kids = childrenByParent[issue.key];
          const kidsLoading = loadingParents.has(issue.key);
          const versionLabel = issue.effectiveFixVersionName
            ? issue.effectiveFixVersionFromEpic && issue.epicKey
              ? `${issue.effectiveFixVersionName} (${issueListText.viaEpic} ${issue.epicKey})`
              : issue.effectiveFixVersionName
            : null;
          const emptyLabel = isEpic ? issueListText.noChildren : issueListText.noSubtasks;

          return (
            <li key={issue.key}>
              <IssueCard
                collapsible={expandable}
                expandable={expandable}
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
                        issueListText.unassigned,
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
                      aria-label={issueListText.edit}
                      onClick={() => onEdit(issue)}
                    >
                      <PencilIcon data-icon="inline-start" />
                      {issueListText.edit}
                    </Button>
                  }
                />
                {expandable ? (
                  <IssueCardChildren>
                    {kidsLoading && !kids ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                        <Spinner />
                      </div>
                    ) : null}
                    {!kidsLoading && kids && kids.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        {emptyLabel}
                      </p>
                    ) : null}
                    {(kids || []).map((child) => (
                      <OpsIssueRow
                        key={child.key}
                        issue={child}
                        jiraBase={jiraBase}
                        nested
                        selectedKeys={selectedKeys}
                        onToggle={onToggle}
                        onEdit={onEdit}
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
