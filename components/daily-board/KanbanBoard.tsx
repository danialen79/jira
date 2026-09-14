"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, MessageSquarePlus, User } from "lucide-react";
import { toast } from "sonner";
import type { Language } from "@/lib/types";
import { IssueStatusBadge } from "@/components/IssueStatusBadge";
import { getIssueTypeBadgeClass } from "@/lib/issue-type-badge";
import { jiraBrowseUrl } from "@/lib/jira-browse";
import type { DailyBoardIssue, KanbanColumn } from "@/lib/daily-board/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Copy = {
  addToLog: string;
  unassigned: string;
  mySubtasks: string;
  emptyColumn: string;
};

function CardBody({
  issue,
  jiraUrl,
  copy,
  onAddToLog,
  dragHandleProps,
  className,
}: {
  issue: DailyBoardIssue;
  jiraUrl: string;
  copy: Copy;
  onAddToLog?: (issue: DailyBoardIssue) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-2.5 shadow-sm",
        className
      )}
      {...dragHandleProps}
    >
      <div className="flex items-start justify-between gap-2">
        <a
          href={jiraBrowseUrl(jiraUrl, issue.key)}
          target="_blank"
          rel="noreferrer"
          referrerPolicy="no-referrer"
          className="font-mono text-xs font-semibold text-primary hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {issue.key}
        </a>
        {onAddToLog ? (
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="shrink-0"
            aria-label={copy.addToLog}
            title={copy.addToLog}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAddToLog(issue);
            }}
          >
            <MessageSquarePlus />
          </Button>
        ) : null}
      </div>
      <p className="line-clamp-3 text-sm leading-snug font-medium">
        {issue.summary}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        <Badge className={getIssueTypeBadgeClass(issue.issuetype)}>
          {issue.issuetype}
        </Badge>
        <Badge
          variant={
            issue.priority === "Highest" || issue.priority === "High"
              ? "warning"
              : "outline"
          }
        >
          {issue.priority}
        </Badge>
        {issue.rolledUpSubtaskCount && issue.rolledUpSubtaskCount > 0 ? (
          <Badge variant="secondary">
            {issue.rolledUpSubtaskCount} {copy.mySubtasks}
          </Badge>
        ) : null}
      </div>
      <div className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
        <User className="size-3 shrink-0" />
        <span className="truncate">
          {issue.assigneeDisplayName ||
            (issue.assignee ? `@${issue.assignee}` : copy.unassigned)}
        </span>
        {issue.timespent > 0 ? (
          <>
            <Clock className="ms-1 size-3 shrink-0" />
            <span className="tabular-nums">
              {Math.round(issue.timespent / 3600)}h
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SortableKanbanCard({
  issue,
  jiraUrl,
  copy,
  onAddToLog,
  columnId,
}: {
  issue: DailyBoardIssue;
  jiraUrl: string;
  copy: Copy;
  onAddToLog: (issue: DailyBoardIssue) => void;
  columnId: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.key,
    data: { columnId, status: issue.status },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-40")}
    >
      <CardBody
        issue={issue}
        jiraUrl={jiraUrl}
        copy={copy}
        onAddToLog={onAddToLog}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function ColumnDroppable({
  column,
  jiraUrl,
  copy,
  onAddToLog,
}: {
  column: KanbanColumn;
  jiraUrl: string;
  copy: Copy;
  onAddToLog: (issue: DailyBoardIssue) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.status}`,
    data: {
      columnId: column.status,
      dropStatusName: column.dropStatusName,
      category: column.category,
      statusNames: column.statusNames,
    },
  });

  const ids = useMemo(() => column.issues.map((i) => i.key), [column.issues]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col gap-2 rounded-xl border bg-muted/30 p-2",
        isOver && "ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <IssueStatusBadge
          status={column.status}
          statusCategoryKey={column.category}
          className="max-w-[12rem] truncate"
        />
        <Badge variant="secondary" className="tabular-nums">
          {column.issues.length}
        </Badge>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex max-h-[min(60vh,560px)] flex-col gap-2 overflow-y-auto pe-0.5">
          {column.issues.length === 0 ? (
            <p className="px-1 py-6 text-center text-xs text-muted-foreground">
              {copy.emptyColumn}
            </p>
          ) : (
            column.issues.map((issue) => (
              <SortableKanbanCard
                key={issue.key}
                issue={issue}
                jiraUrl={jiraUrl}
                copy={copy}
                onAddToLog={onAddToLog}
                columnId={column.status}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export default function KanbanBoard({
  columns,
  jiraUrl,
  language,
  onStatusChange,
  onAddToLog,
}: {
  columns: KanbanColumn[];
  jiraUrl: string;
  language: Language;
  /** Called with the Jira status name to transition to. */
  onStatusChange: (issueKey: string, jiraStatusName: string) => void;
  onAddToLog: (issue: DailyBoardIssue) => void;
}) {
  const copy: Copy =
    language === "fa"
      ? {
          addToLog: "افزودن به ثبت کارکرد",
          unassigned: "بدون مسئول",
          mySubtasks: "ساب‌تسک من",
          emptyColumn: "خالی",
        }
      : {
          addToLog: "Add to worklog",
          unassigned: "Unassigned",
          mySubtasks: "my sub-tasks",
          emptyColumn: "Empty",
        };

  const [activeIssue, setActiveIssue] = useState<DailyBoardIssue | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const issueByKey = useMemo(() => {
    const map = new Map<string, DailyBoardIssue>();
    for (const col of columns) {
      for (const issue of col.issues) map.set(issue.key, issue);
    }
    return map;
  }, [columns]);

  const columnByIssueKey = useMemo(() => {
    const map = new Map<string, KanbanColumn>();
    for (const col of columns) {
      for (const issue of col.issues) map.set(issue.key, col);
    }
    return map;
  }, [columns]);

  const findColumnId = (id: string): string | null => {
    if (id.startsWith("column:")) return id.slice("column:".length);
    return columnByIssueKey.get(id)?.status ?? null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveIssue(issueByKey.get(String(event.active.id)) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;
    const issueKey = String(active.id);
    const overId = String(over.id);
    const fromColumnId =
      (active.data.current?.columnId as string | undefined) ||
      findColumnId(issueKey);
    const toColumnId =
      (over.data.current?.columnId as string | undefined) ||
      findColumnId(overId);
    if (!fromColumnId || !toColumnId || fromColumnId === toColumnId) return;

    const toColumn = columns.find((c) => c.status === toColumnId);
    const dropStatus =
      (over.data.current?.dropStatusName as string | null | undefined) ??
      toColumn?.dropStatusName ??
      null;
    if (!dropStatus) {
      toast.error(
        language === "fa"
          ? "این ستون وضعیت Jira ندارد."
          : "This column has no mapped Jira status."
      );
      return;
    }
    onStatusChange(issueKey, dropStatus);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <ColumnDroppable
            key={column.status}
            column={column}
            jiraUrl={jiraUrl}
            copy={copy}
            onAddToLog={onAddToLog}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <div className="w-72 cursor-grabbing opacity-95 shadow-lg">
            <CardBody issue={activeIssue} jiraUrl={jiraUrl} copy={copy} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

