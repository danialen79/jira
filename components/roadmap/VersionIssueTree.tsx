"use client";

import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ArrowRightLeftIcon, Layers, PencilIcon, User } from "lucide-react";
import type { Language, VersionIssue } from "@/lib/types";
import { lensDisplayLabel } from "@/lib/lens";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { isEpicIssueType } from "@/lib/fix-version-policy";
import { jiraBrowseUrl, normalizeJiraBase } from "@/lib/jira-browse";
import {
  IssueCard,
  IssueCardChildren,
  IssueCardFooter,
  IssueCardHeader,
  IssueKeyLink,
} from "@/components/issue-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  tree: VersionIssue[];
  total?: number;
  jiraUrl: string;
  language: Language;
  className?: string;
  /** When true (default), epics expand and load stories on open. */
  lazyEpicChildren?: boolean;
  onEditIssue?: (issue: VersionIssue, nestedUnderEpic: boolean) => void;
  onChangeVersion?: (issue: VersionIssue) => void;
};

const copy = {
  en: {
    empty: "No issues",
    emptyHint: "Assign Fix Version on epics (or orphan stories) in Jira.",
    unassigned: "Unassigned",
    children: (n: number) => `${n} issues`,
    loadChildren: "Stories",
    loadingChildren: "Loading stories…",
    loadFailed: "Could not load stories.",
    noChildren: "No stories under this epic.",
    edit: "Edit",
    changeVersion: "Change version",
  },
  fa: {
    empty: "ایشویی نیست",
    emptyHint: "Fix Version را روی اپیک (یا استوری بدون اپیک) تنظیم کنید.",
    unassigned: "بدون مسئول",
    children: (n: number) => `${n} ایشو`,
    loadChildren: "استوری‌ها",
    loadingChildren: "در حال بارگذاری استوری‌ها…",
    loadFailed: "بارگذاری استوری‌ها ناموفق بود.",
    noChildren: "استوری زیر این اپیک نیست.",
    edit: "ویرایش",
    changeVersion: "تغییر ورژن",
  },
} as const;

function issueBadges(
  issue: VersionIssue,
  language: Language,
  jiraBase: string,
  extra?: ReactNode
) {
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
      {extra}
    </>
  );
}

function IssueActions({
  issue,
  language,
  nestedUnderEpic,
  onEditIssue,
  onChangeVersion,
}: {
  issue: VersionIssue;
  language: Language;
  nestedUnderEpic: boolean;
  onEditIssue?: (issue: VersionIssue, nestedUnderEpic: boolean) => void;
  onChangeVersion?: (issue: VersionIssue) => void;
}) {
  const t = copy[language];
  const canChangeVersion = !nestedUnderEpic;
  if (!onEditIssue && !onChangeVersion) return null;

  return (
    <>
      {onEditIssue ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onEditIssue(issue, nestedUnderEpic)}
        >
          <PencilIcon data-icon="inline-start" />
          {t.edit}
        </Button>
      ) : null}
      {canChangeVersion && onChangeVersion ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChangeVersion(issue)}
        >
          <ArrowRightLeftIcon data-icon="inline-start" />
          {t.changeVersion}
        </Button>
      ) : null}
    </>
  );
}

function TreeIssueCard({
  issue,
  jiraBase,
  language,
  nested = false,
  lazyEpicChildren,
  childrenByEpic,
  loadingEpics,
  expanded,
  onToggleEpic,
  onEditIssue,
  onChangeVersion,
}: {
  issue: VersionIssue;
  jiraBase: string;
  language: Language;
  nested?: boolean;
  lazyEpicChildren: boolean;
  childrenByEpic: Record<string, VersionIssue[]>;
  loadingEpics: Set<string>;
  expanded: Set<string>;
  onToggleEpic: (epicKey: string, open: boolean, seed?: VersionIssue[]) => void;
  onEditIssue?: (issue: VersionIssue, nestedUnderEpic: boolean) => void;
  onChangeVersion?: (issue: VersionIssue) => void;
}) {
  const t = copy[language];
  const isEpic = isEpicIssueType(issue.issuetype);
  const seeded = issue.children;
  const kids =
    childrenByEpic[issue.key] ??
    (seeded && seeded.length > 0 ? seeded : undefined);
  const kidsLoading = loadingEpics.has(issue.key);
  const expandable = isEpic && (lazyEpicChildren || (kids?.length ?? 0) > 0);
  const isOpen = expanded.has(issue.key);
  const actions = (
    <IssueActions
      issue={issue}
      language={language}
      nestedUnderEpic={nested}
      onEditIssue={onEditIssue}
      onChangeVersion={onChangeVersion}
    />
  );
  const hasActions = !!(onEditIssue || (!nested && onChangeVersion));
  const countLabel =
    kids != null
      ? t.children(kids.length)
      : lazyEpicChildren && isEpic
        ? t.loadChildren
        : null;

  return (
    <IssueCard
      nested={nested}
      collapsible={expandable}
      expandable={expandable}
      open={expandable ? isOpen : undefined}
      onOpenChange={
        expandable
          ? (open) => onToggleEpic(issue.key, open, seeded)
          : undefined
      }
    >
      <IssueCardHeader
        title={issue.summary}
        badges={issueBadges(
          issue,
          language,
          jiraBase,
          countLabel ? (
            <Badge variant="secondary">{countLabel}</Badge>
          ) : null
        )}
      />
      <IssueCardFooter
        meta={[
          {
            icon: User,
            label: issue.assigneeDisplayName || t.unassigned,
            key: "assignee",
          },
        ]}
        actions={hasActions ? actions : undefined}
      />
      {expandable ? (
        <IssueCardChildren>
          {kidsLoading ? (
            <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
              <Spinner />
              {t.loadingChildren}
            </div>
          ) : kids == null ? (
            <div className="flex flex-col gap-2 px-1 py-1">
              <Skeleton className="h-10 w-full" />
            </div>
          ) : kids.length === 0 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              {t.noChildren}
            </p>
          ) : (
            kids.map((child) => (
              <TreeIssueCard
                key={child.key}
                issue={child}
                jiraBase={jiraBase}
                language={language}
                nested
                lazyEpicChildren={false}
                childrenByEpic={childrenByEpic}
                loadingEpics={loadingEpics}
                expanded={expanded}
                onToggleEpic={onToggleEpic}
                onEditIssue={onEditIssue}
                onChangeVersion={onChangeVersion}
              />
            ))
          )}
        </IssueCardChildren>
      ) : null}
    </IssueCard>
  );
}

export default function VersionIssueTree({
  tree,
  total,
  jiraUrl,
  language,
  className,
  lazyEpicChildren = true,
  onEditIssue,
  onChangeVersion,
}: Props) {
  const t = copy[language];
  const base = normalizeJiraBase(jiraUrl);
  const [childrenByEpic, setChildrenByEpic] = useState<
    Record<string, VersionIssue[]>
  >({});
  const [loadingEpics, setLoadingEpics] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadEpicChildren = useCallback(
    async (epicKey: string) => {
      setLoadingEpics((prev) => new Set(prev).add(epicKey));
      try {
        const res = await fetch(
          `/api/jira/issues/epic-children?epicKey=${encodeURIComponent(epicKey)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error(data.error || t.loadFailed);
          setExpanded((prev) => {
            const next = new Set(prev);
            next.delete(epicKey);
            return next;
          });
          return;
        }
        setChildrenByEpic((prev) => ({
          ...prev,
          [epicKey]: (data.issues || []) as VersionIssue[],
        }));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t.loadFailed);
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(epicKey);
          return next;
        });
      } finally {
        setLoadingEpics((prev) => {
          const next = new Set(prev);
          next.delete(epicKey);
          return next;
        });
      }
    },
    [t.loadFailed]
  );

  const onToggleEpic = useCallback(
    (epicKey: string, open: boolean, seed?: VersionIssue[]) => {
      if (!open) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(epicKey);
          return next;
        });
        return;
      }

      setExpanded((prev) => new Set(prev).add(epicKey));

      if (childrenByEpic[epicKey]) return;

      if (seed && seed.length > 0) {
        setChildrenByEpic((prev) => ({ ...prev, [epicKey]: seed }));
        return;
      }

      if (lazyEpicChildren) {
        void loadEpicChildren(epicKey);
      } else {
        setChildrenByEpic((prev) => ({ ...prev, [epicKey]: seed || [] }));
      }
    },
    [childrenByEpic, lazyEpicChildren, loadEpicChildren]
  );

  const flatCount = tree.reduce(
    (n, issue) => n + 1 + (issue.children?.length || 0),
    0
  );

  if (tree.length === 0) {
    return (
      <Empty className="border py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers />
          </EmptyMedia>
          <EmptyTitle>{t.empty}</EmptyTitle>
          <EmptyDescription>{t.emptyHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className={className}>
      {typeof total === "number" && total > flatCount && (
        <p className="mb-2 text-xs text-muted-foreground">
          {language === "fa"
            ? `نمایش درخت از ${total} ایشوی ورژن`
            : `Tree from ${total} version issues`}
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {tree.map((issue) => (
          <li key={issue.key}>
            <TreeIssueCard
              issue={issue}
              jiraBase={base}
              language={language}
              lazyEpicChildren={lazyEpicChildren}
              childrenByEpic={childrenByEpic}
              loadingEpics={loadingEpics}
              expanded={expanded}
              onToggleEpic={onToggleEpic}
              onEditIssue={onEditIssue}
              onChangeVersion={onChangeVersion}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
