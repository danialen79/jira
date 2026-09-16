"use client";

import { useMemo, useState } from "react";
import { ListTreeIcon, User } from "lucide-react";
import { toast } from "sonner";
import SearchableSelect from "@/components/SearchableSelect";
import {
  IssueCard,
  IssueCardFooter,
  IssueCardHeader,
  IssueKeyLink,
} from "@/components/issue-card";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { jiraBrowseUrl, normalizeJiraBase } from "@/lib/jira-browse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { useIssueSelection } from "@/hooks/use-issue-selection";
import { nestSprintIssues, statusBucket } from "@/lib/sprint/map";
import type { JiraSprint, SprintIssue } from "@/lib/types";

type StatusFilter = "ALL" | "todo" | "inProgress" | "done";

type Props = {  jiraUrl: string;
  issues: SprintIssue[];
  loading: boolean;
  futureSprints: JiraSprint[];
  currentSprintId: number | null;
  onMoved: () => void;
};

const t = {
    all: "همه",
    todo: "باز",
    ip: "در جریان",
    done: "انجام‌شده",
    search: "جستجوی کلید یا عنوان",
    selectAll: "انتخاب نمایش‌داده‌ها",
    selected: "انتخاب‌شده",
    clear: "پاک",
    moveTo: "انتقال به",
    backlog: "بک‌لاگ",
    apply: "انتقال",
    moving: "در حال انتقال…",
    empty: "ایشویی نیست",
    emptyHint: "کاری مطابق فیلتر در این اسپرینت نیست.",
    unassigned: "بدون مسئول",
    moved: "منتقل شد.",
    fail: "انتقال ناموفق بود.",
    subDone: (done: number, total: number) => `${done}/${total} دان`,
    viewSubs: "ساب‌تسک‌ها",
    subsTitle: "ساب‌تسک‌ها",
    parentOutside: "والد خارج از اسپرینت",
    noSubs: "ساب‌تسکی نیست",
  } as const;

function issueMatches(
  issue: SprintIssue,
  status: StatusFilter,
  query: string
): boolean {
  if (issue.placeholder) return false;
  const bucket = statusBucket(issue.statusCategoryKey);
  if (status !== "ALL" && bucket !== status) return false;
  if (!query) return true;
  return (
    issue.key.toLowerCase().includes(query) ||
    issue.summary.toLowerCase().includes(query) ||
    (issue.assigneeDisplayName || "").toLowerCase().includes(query)
  );
}

function subtaskStats(kids: SprintIssue[]) {
  const total = kids.length;
  const done = kids.filter(
    (c) => statusBucket(c.statusCategoryKey) === "done"
  ).length;
  return { total, done };
}

/** Top-level only; keep children attached for dialog/stats, never render inline. */
function filterRoots(
  nodes: SprintIssue[],
  status: StatusFilter,
  query: string
): SprintIssue[] {
  const out: SprintIssue[] = [];
  for (const node of nodes) {
    const kids = node.children || [];
    const selfMatch = issueMatches(node, status, query);
    const childMatch = kids.some((c) => issueMatches(c, status, query));

    if (node.placeholder) {
      if (kids.length === 0) continue;
      if (query && !childMatch && !node.key.toLowerCase().includes(query) && !node.summary.toLowerCase().includes(query)) {
        continue;
      }
      out.push(node);
      continue;
    }

    if (selfMatch || (query && childMatch)) {
      out.push(node);
    }
  }
  return out;
}

export default function SprintWorkPanel({  jiraUrl,
  issues,
  loading,
  futureSprints,
  currentSprintId,
  onMoved,
}: Props) {  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [q, setQ] = useState("");
  const [dest, setDest] = useState("");
  const [moving, setMoving] = useState(false);
  const [subsFor, setSubsFor] = useState<SprintIssue | null>(null);
  const selection = useIssueSelection();

  const roots = useMemo(() => {
    const nested = nestSprintIssues(issues);
    return filterRoots(nested, status, q.trim().toLowerCase());
  }, [issues, q, status]);

  const visibleKeys = useMemo(
    () => roots.filter((i) => !i.placeholder).map((i) => i.key),
    [roots]
  );
  const base = normalizeJiraBase(jiraUrl);

  const destOptions = [
    { value: "backlog", label: t.backlog },
    ...futureSprints
      .filter((s) => s.id !== currentSprintId)
      .map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const handleMove = async () => {
    if (selection.count === 0 || !dest) return;
    setMoving(true);
    try {
      const url =
        dest === "backlog"
          ? `/api/jira/sprints/${currentSprintId || 0}/move`
          : `/api/jira/sprints/${dest}/move`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issues: selection.selectedKeys,
          ...(dest === "backlog" ? { target: "backlog" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.fail);
      toast.success(t.moved);
      selection.clear();
      onMoved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t.fail);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          value={[status]}
          onValueChange={(values) => {
            if (!values.length) return;
            setStatus(values[0] as StatusFilter);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="ALL">{t.all}</ToggleGroupItem>
          <ToggleGroupItem value="todo">{t.todo}</ToggleGroupItem>
          <ToggleGroupItem value="inProgress">{t.ip}</ToggleGroupItem>
          <ToggleGroupItem value="done">{t.done}</ToggleGroupItem>
        </ToggleGroup>
        <Input
          className="max-w-xs"
          placeholder={t.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {selection.count > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
          <span className="text-sm">
            {selection.count} {t.selected}
          </span>
          <Button variant="ghost" size="sm" onClick={selection.clear}>
            {t.clear}
          </Button>
          <SearchableSelect
            className="max-w-[220px]"
            options={destOptions}
            value={dest}
            onChange={setDest}
            placeholder={t.moveTo}
            showSearch={false}
            />
          <Button
            size="sm"
            onClick={() => void handleMove()}
            disabled={moving || !dest}
          >
            {moving ? <Spinner data-icon="inline-start" /> : null}
            {moving ? t.moving : t.apply}
          </Button>
        </div>
      )}

      {loading && issues.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner />
        </div>
      ) : roots.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>{t.empty}</EmptyTitle>
            <EmptyDescription>{t.emptyHint}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={
                visibleKeys.length > 0 &&
                visibleKeys.every((k) => selection.isSelected(k))
              }
              onCheckedChange={() => selection.togglePage(visibleKeys)}
              aria-label={t.selectAll}
            />
            <span className="text-xs text-muted-foreground">{t.selectAll}</span>
          </div>
          <ul className="flex flex-col gap-2">
            {roots.map((issue) => {
              const kids = issue.children || [];
              const { total, done } = subtaskStats(kids);
              return (
                <li key={issue.key}>
                  <IssueCard>
                    <IssueCardHeader
                      title={issue.summary}
                      leading={
                        !issue.placeholder ? (
                          <Checkbox
                            checked={selection.isSelected(issue.key)}
                            onCheckedChange={() =>
                              selection.toggle(issue.key)
                            }
                            aria-label={issue.key}
                          />
                        ) : undefined
                      }
                      badges={
                        <>
                          <IssueKeyLink
                            href={jiraBrowseUrl(base, issue.key)}
                            issueKey={issue.key}
                          />
                          {!issue.placeholder ? (
                            <Badge
                              className={getIssueTypeBadgeClass(
                                issue.issuetype
                              )}
                            >
                              {issue.issuetype}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              {t.parentOutside}
                            </Badge>
                          )}
                          {!issue.placeholder ? (
                            <IssueStatusBadge
                              status={issue.status}
                              statusCategoryKey={issue.statusCategoryKey}
                            />
                          ) : null}
                          {total > 0 ? (
                            <Badge variant="secondary">
                              {t.subDone(done, total)}
                            </Badge>
                          ) : null}
                        </>
                      }
                    />
                    <IssueCardFooter
                      meta={
                        !issue.placeholder
                          ? [
                              {
                                icon: User,
                                label:
                                  issue.assigneeDisplayName || t.unassigned,
                                key: "assignee",
                              },
                            ]
                          : undefined
                      }
                      actions={
                        total > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setSubsFor(issue)}
                          >
                            <ListTreeIcon data-icon="inline-start" />
                            {t.viewSubs}
                          </Button>
                        ) : undefined
                      }
                    />
                  </IssueCard>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Dialog
        open={!!subsFor}
        onOpenChange={(open) => {
          if (!open) setSubsFor(null);
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t.subsTitle}
              {subsFor ? ` — ${subsFor.key}` : ""}
            </DialogTitle>
          </DialogHeader>
          {subsFor && (subsFor.children?.length || 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noSubs}</p>
          ) : (
            <ul className="flex flex-col">
              {(subsFor?.children || []).map((child, i) => {
                return (
                  <li key={child.key} className="flex flex-col">
                    {i > 0 ? (
                      <div className="h-px w-full bg-border" />
                    ) : null}
                    <IssueCard nested density="compact">
                      <IssueCardHeader
                        title={child.summary}
                        badges={
                          <>
                            <IssueKeyLink
                              href={jiraBrowseUrl(base, child.key)}
                              issueKey={child.key}
                              showIcon={false}
                            />
                            <Badge
                              className={getIssueTypeBadgeClass(
                                child.issuetype
                              )}
                            >
                              {child.issuetype}
                            </Badge>
                            <IssueStatusBadge
                              status={child.status}
                              statusCategoryKey={child.statusCategoryKey}
                            />
                          </>
                        }
                      />
                      <IssueCardFooter
                        meta={[
                          {
                            icon: User,
                            label:
                              child.assigneeDisplayName || t.unassigned,
                            key: "assignee",
                          },
                        ]}
                      />
                    </IssueCard>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
