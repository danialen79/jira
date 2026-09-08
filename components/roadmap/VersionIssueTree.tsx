"use client";

import {
  ArrowRightLeftIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  Layers,
  PencilIcon,
} from "lucide-react";
import type { Language, VersionIssue } from "@/lib/types";
import { lensDisplayLabel } from "@/lib/lens";
import { isEpicIssueType } from "@/lib/fix-version-policy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type Props = {
  tree: VersionIssue[];
  total?: number;
  jiraUrl: string;
  language: Language;
  className?: string;
  onEditIssue?: (issue: VersionIssue, nestedUnderEpic: boolean) => void;
  onChangeVersion?: (issue: VersionIssue) => void;
};

const copy = {
  en: {
    empty: "No issues",
    emptyHint: "Assign Fix Version on epics (or orphan stories) in Jira.",
    unassigned: "Unassigned",
    children: (n: number) => `${n} issues`,
    edit: "Edit",
    changeVersion: "Change version",
  },
  fa: {
    empty: "ایشویی نیست",
    emptyHint: "Fix Version را روی اپیک (یا استوری بدون اپیک) تنظیم کنید.",
    unassigned: "بدون مسئول",
    children: (n: number) => `${n} ایشو`,
    edit: "ویرایش",
    changeVersion: "تغییر ورژن",
  },
} as const;

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
    <div className="flex flex-wrap gap-1.5 pt-1">
      {onEditIssue && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onEditIssue(issue, nestedUnderEpic)}
        >
          <PencilIcon data-icon="inline-start" />
          {t.edit}
        </Button>
      )}
      {canChangeVersion && onChangeVersion && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChangeVersion(issue)}
        >
          <ArrowRightLeftIcon data-icon="inline-start" />
          {t.changeVersion}
        </Button>
      )}
    </div>
  );
}

function IssueRow({
  issue,
  jiraBase,
  language,
  nested = false,
  onEditIssue,
  onChangeVersion,
}: {
  issue: VersionIssue;
  jiraBase: string;
  language: Language;
  nested?: boolean;
  onEditIssue?: (issue: VersionIssue, nestedUnderEpic: boolean) => void;
  onChangeVersion?: (issue: VersionIssue) => void;
}) {
  const t = copy[language];
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border/70 bg-card/40 px-3 py-2.5",
        nested && "border-dashed bg-muted/20"
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <a
          href={`${jiraBase}/browse/${issue.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          translate="no"
        >
          {issue.key}
          <ExternalLinkIcon className="size-3 opacity-60" aria-hidden />
        </a>
        <div className="flex flex-wrap justify-end gap-1">
          <Badge variant="secondary">{issue.issuetype}</Badge>
          <Badge variant="outline">{issue.status}</Badge>
          {issue.lens && (
            <Badge variant="outline">
              {lensDisplayLabel(issue.lens, language)}
            </Badge>
          )}
        </div>
      </div>
      <p className="text-sm leading-snug text-foreground">{issue.summary}</p>
      <p className="text-xs text-muted-foreground">
        {issue.assigneeDisplayName || t.unassigned}
      </p>
      <IssueActions
        issue={issue}
        language={language}
        nestedUnderEpic={nested}
        onEditIssue={onEditIssue}
        onChangeVersion={onChangeVersion}
      />
    </div>
  );
}

export default function VersionIssueTree({
  tree,
  total,
  jiraUrl,
  language,
  className,
  onEditIssue,
  onChangeVersion,
}: Props) {
  const t = copy[language];
  const base = jiraUrl.replace(/\/+$/, "");
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
        {tree.map((issue) => {
          if (isEpicIssueType(issue.issuetype)) {
            const kids = issue.children || [];
            return (
              <li key={issue.key}>
                <Collapsible defaultOpen={false}>
                  <div className="rounded-xl border border-border/80 bg-muted/15">
                    <CollapsibleTrigger className="group flex w-full items-start gap-2 px-3 py-2.5 text-start outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50">
                      <ChevronDownIcon className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                          <a
                            href={`${base}/browse/${issue.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                            translate="no"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {issue.key}
                            <ExternalLinkIcon
                              className="size-3 opacity-60"
                              aria-hidden
                            />
                          </a>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="default">Epic</Badge>
                            <Badge variant="outline">{issue.status}</Badge>
                            <Badge variant="secondary">
                              {t.children(kids.length)}
                            </Badge>
                          </div>
                        </div>
                        <p className="mt-1 text-sm leading-snug">
                          {issue.summary}
                        </p>
                      </div>
                    </CollapsibleTrigger>
                    <div className="border-t border-border/40 px-3 py-2">
                      <IssueActions
                        issue={issue}
                        language={language}
                        nestedUnderEpic={false}
                        onEditIssue={onEditIssue}
                        onChangeVersion={onChangeVersion}
                      />
                    </div>
                    <CollapsibleContent className="border-t border-border/60 px-3 py-2">
                      {kids.length === 0 ? (
                        <p className="py-2 text-xs text-muted-foreground">
                          {t.empty}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-2 ps-2">
                          {kids.map((child) => (
                            <li key={child.key}>
                              <IssueRow
                                issue={child}
                                jiraBase={base}
                                language={language}
                                nested
                                onEditIssue={onEditIssue}
                                onChangeVersion={onChangeVersion}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </li>
            );
          }

          return (
            <li key={issue.key}>
              <IssueRow
                issue={issue}
                jiraBase={base}
                language={language}
                onEditIssue={onEditIssue}
                onChangeVersion={onChangeVersion}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
