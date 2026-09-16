"use client";

import { Layers, User } from "lucide-react";
import type { VersionIssue } from "@/lib/types";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { jiraBrowseUrl, normalizeJiraBase } from "@/lib/jira-browse";
import { lensDisplayLabel } from "@/lib/lens";
import { cn } from "@/lib/utils";
import {
  IssueCard,
  IssueCardFooter,
  IssueCardHeader,
  IssueKeyLink,
} from "@/components/issue-card";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
  issues: VersionIssue[];
  total?: number;
  jiraUrl: string;  compact?: boolean;
  className?: string;
};

const t = {
    showing: (n: number, total: number) => `نمایش ${n} از ${total}`,
    empty: "ایشویی نیست",
    emptyHint: "Fix Version را روی ایشوها تنظیم کنید.",
    unassigned: "بدون مسئول",
  } as const;

export default function VersionIssueList({
  issues,
  total,
  jiraUrl,  compact = false,
  className,
}: Props) {  const base = normalizeJiraBase(jiraUrl);
  const shownTotal = total ?? issues.length;
  const density = compact ? "compact" : "comfortable";

  if (issues.length === 0) {
    return (
      <Empty
        className={cn(compact ? "border py-6" : "border py-8", className)}
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Layers />
          </EmptyMedia>
          <EmptyTitle>{t.empty}</EmptyTitle>
          {!compact && <EmptyDescription>{t.emptyHint}</EmptyDescription>}
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {shownTotal > issues.length && (
        <p className="mb-2 shrink-0 text-xs text-muted-foreground">
          {t.showing(issues.length, shownTotal)}
        </p>
      )}
      <ScrollArea
        className={
          compact
            ? "h-full min-h-48 flex-1 pe-2"
            : "h-[min(60vh,28rem)] pe-3"
        }
      >
        <ul className="flex flex-col gap-2">
          {issues.map((issue) => (
            <li key={issue.key}>
              <IssueCard density={density}>
                <IssueCardHeader
                  title={issue.summary}
                  badges={
                    <>
                      <IssueKeyLink
                        href={jiraBrowseUrl(base, issue.key)}
                        issueKey={issue.key}
                        showIcon={!compact}
                      />
                      <Badge
                        className={getIssueTypeBadgeClass(issue.issuetype)}
                      >
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
                  }
                />
                {!compact ? (
                  <IssueCardFooter
                    meta={[
                      {
                        icon: User,
                        label: issue.assigneeDisplayName || t.unassigned,
                        key: "assignee",
                      },
                    ]}
                  />
                ) : null}
              </IssueCard>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
