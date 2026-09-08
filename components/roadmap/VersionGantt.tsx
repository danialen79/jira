"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  Gantt,
  Willow,
  WillowDark,
  type IApi,
  type ITask,
} from "@svar-ui/react-gantt";
import { Locale } from "@svar-ui/react-core";
import { en as enCore } from "@svar-ui/core-locales";
import { en as enGantt } from "@svar-ui/gantt-locales";
import type { Language, JiraVersion } from "@/lib/types";
import {
  buildTimelineBounds,
  cellWidthForMode,
  getScalesForMode,
  getVersionRangeFromTasks,
  mapIssuesToGanttTasks,
  mapVersionsToGanttTasks,
  parseIssueTaskId,
  parseVersionTaskId,
  type RoadmapGanttTask,
  type RoadmapScaleMode,
} from "@/lib/gantt-roadmap";
import { svarLocaleFa } from "@/lib/svar-locale-fa";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import "@svar-ui/react-gantt/all.css";

type Props = {
  versions: JiraVersion[];
  language: Language;
  isRtl: boolean;
  jiraUrl: string;
  scaleMode: RoadmapScaleMode;
  onOpenVersion?: (version: JiraVersion) => void;
};

type BarTemplateProps = {
  data: ITask;
  api?: IApi;
  onaction?: (ev: {
    action: string;
    data: { [key: string]: unknown };
  }) => void;
  onAction?: (ev: {
    action: string;
    data: { [key: string]: unknown };
  }) => void;
};

function createTaskBarTemplate(onBarClick: (id: string | number) => void) {
  return function TaskBarTemplate({
    data,
    onaction,
    onAction,
  }: BarTemplateProps) {
    const task = data as RoadmapGanttTask;
    const css = task.css || "";
    const text = data.text || "";
    const title = (data.details as string) || text;
    const clickable = task.kind === "version" || task.kind === "issue";

    const emitClick = () => {
      if (!clickable || data.id == null) return;
      const notify = onaction || onAction;
      if (typeof notify === "function") {
        notify({ action: "bar-click", data: { id: data.id } });
      }
      onBarClick(data.id);
    };

    return (
      <div
        className={cn(
          "wx-content rm-task-inner",
          css,
          clickable && "cursor-pointer"
        )}
        title={title}
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={(e) => {
          e.stopPropagation();
          emitClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            emitClick();
          }
        }}
      >
        <span className="truncate px-1.5">{text}</span>
      </div>
    );
  };
}

export default function VersionGantt({
  versions,
  language,
  isRtl,
  jiraUrl,
  scaleMode,
  onOpenVersion,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const apiRef = useRef<IApi | null>(null);
  const tasksRef = useRef<RoadmapGanttTask[]>([]);
  const versionsRef = useRef(versions);
  const onOpenRef = useRef(onOpenVersion);
  versionsRef.current = versions;
  onOpenRef.current = onOpenVersion;

  useEffect(() => {
    setMounted(true);
  }, []);

  const tasks = useMemo(() => mapVersionsToGanttTasks(versions), [versions]);
  tasksRef.current = tasks;

  const bounds = useMemo(() => buildTimelineBounds(tasks), [tasks]);
  const scales = useMemo(
    () => getScalesForMode(scaleMode, language),
    [scaleMode, language]
  );
  const cellWidth = cellWidthForMode(scaleMode);

  const localeWords = useMemo(
    () =>
      language === "fa" ? { ...svarLocaleFa } : { ...enCore, ...enGantt },
    [language]
  );

  const columns = useMemo(
    () => [
      {
        id: "text",
        header: language === "fa" ? "نام" : "Name",
        flexgrow: 1,
        width: 220,
        sort: false,
      },
    ],
    [language]
  );

  const handleRequestData = useCallback(
    async ({ id }: { id: string | number }) => {
      const api = apiRef.current;
      const versionId = parseVersionTaskId(id);
      if (!api || !versionId) return;

      const range = getVersionRangeFromTasks(tasksRef.current, versionId);
      if (!range) {
        api.exec("provide-data", { id, data: { tasks: [] } });
        return;
      }

      try {
        const res = await fetch(
          `/api/jira/versions/issues?versionId=${encodeURIComponent(versionId)}`
        );
        const data = await res.json();
        if (!res.ok || !data.success) {
          api.exec("provide-data", { id, data: { tasks: [] } });
          return;
        }
        const childTasks = mapIssuesToGanttTasks(
          versionId,
          data.issues || [],
          range
        );
        api.exec("provide-data", {
          id,
          data: { tasks: childTasks },
        });
      } catch {
        api.exec("provide-data", { id, data: { tasks: [] } });
      }
    },
    []
  );

  const openByTaskId = useCallback((id: string | number) => {
    const issueKey = parseIssueTaskId(id);
    if (issueKey) {
      const base = jiraUrl.replace(/\/+$/, "");
      window.open(
        `${base}/browse/${issueKey}`,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }

    const versionId = parseVersionTaskId(id);
    if (versionId && onOpenRef.current) {
      const v = versionsRef.current.find((x) => x.id === versionId);
      if (v) onOpenRef.current(v);
    }
  }, [jiraUrl]);

  const TaskBarTemplate = useMemo(
    () => createTaskBarTemplate(openByTaskId),
    [openByTaskId]
  );

  const init = useCallback(
    (api: IApi) => {
      apiRef.current = api;
      api.on("request-data", handleRequestData);

      api.on("select-task", ({ id }: { id: string | number }) => {
        openByTaskId(id);
      });

      api.intercept("show-editor", ({ id }: { id: string | number }) => {
        openByTaskId(id);
        return false;
      });
    },
    [handleRequestData, openByTaskId]
  );

  if (tasks.length === 0 || !bounds) {
    return (
      <Empty className="border py-12">
        <EmptyHeader>
          <EmptyTitle>
            {language === "fa" ? "بازه تاریخی نیست" : "No dated versions"}
          </EmptyTitle>
          <EmptyDescription>
            {language === "fa"
              ? "برای ورژن‌ها Start/Release Date بگذارید."
              : "Set Start/Release dates on Fix Versions."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!mounted) {
    return <Skeleton className="h-[min(70vh,40rem)] min-h-[28rem] w-full" />;
  }

  const dark = resolvedTheme === "dark";
  const themeClass = dark ? "wx-willow-dark-theme" : "wx-willow-theme";

  return (
    <div
      className={cn(
        "roadmap-gantt bg-card text-card-foreground h-[min(70vh,40rem)] min-h-[28rem] overflow-hidden rounded-xl border shadow-none",
        themeClass,
        isRtl && "roadmap-gantt-rtl"
      )}
      // SVAR timeline uses absolute LTR coords — dir=rtl shifts bars vs scale labels
      dir="ltr"
    >
      <Locale words={localeWords}>
        {/* SVAR: theme component is a sibling, not a parent of Gantt */}
        {dark ? <WillowDark fonts={false} /> : <Willow fonts={false} />}
        <div className="h-full min-w-0 w-full">
          <Gantt
            key={`${scaleMode}-${language}-${tasks.length}`}
            tasks={tasks}
            links={[]}
            scales={scales}
            columns={columns}
            start={bounds.start}
            end={bounds.end}
            cellWidth={cellWidth}
            cellHeight={36}
            scaleHeight={28}
            readonly
            autoScale={false}
            cellBorders="column"
            highlightTime={() => ""}
            taskTemplate={TaskBarTemplate}
            init={init}
          />
        </div>
      </Locale>
    </div>
  );
}
