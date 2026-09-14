"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  GanttChart,
  Layers,
  PlusIcon,
} from "lucide-react";
import type { Language, JiraVersion } from "@/lib/types";
import { isCurrentVersion } from "@/lib/roadmap";
import {
  filterVersionsWithBoundaryInMonth,
  formatViewPeriodTitle,
  getViewBounds,
  normalizeAnchor,
  shiftAnchor,
  type RoadmapScaleMode,
} from "@/lib/gantt-roadmap";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import VersionDetailSheet from "@/components/VersionDetailSheet";
import VersionGantt from "@/components/roadmap/VersionGantt";
import CurrentVersionsPanel from "@/components/roadmap/CurrentVersionsPanel";
import CreateVersionDialog from "@/components/roadmap/CreateVersionDialog";
import MonthlyVersionsPanel from "@/components/roadmap/MonthlyVersionsPanel";

type Props = {
  language: Language;
  isRtl: boolean;
  jiraUrl: string;
  jiraConnected: boolean;
  versions: JiraVersion[];
  fetchingVersions: boolean;
  onRefreshVersions: () => Promise<void>;
};

const copy = {
  en: {
    timeline: "Roadmap",
    current: "Current versions",
    showArchived: "Show archived",
    noVersions: "No versions found",
    noVersionsHint: "Create a Fix Version from New version.",
    notConnected: "Jira is not connected",
    notConnectedHint: "Configure Jira in Settings, then refresh.",
    refresh: "Refresh",
    create: "New version",
    fourMonth: "4 months",
    year: "Year",
    month: "Month",
    scaleLabel: "View",
    prevPeriod: "Previous period",
    nextPeriod: "Next period",
  },
  fa: {
    timeline: "رودمپ",
    current: "ورژن فعلی",
    showArchived: "نمایش بایگانی",
    noVersions: "ورژنی یافت نشد",
    noVersionsHint: "از «ورژن جدید» یک Fix Version بسازید.",
    notConnected: "جیرا متصل نیست",
    notConnectedHint: "جیرا را در Settings پیکربندی کنید.",
    refresh: "بروزرسانی",
    create: "ورژن جدید",
    fourMonth: "۴ ماهه",
    year: "سالانه",
    month: "ماهانه",
    scaleLabel: "نمایش",
    prevPeriod: "دوره قبل",
    nextPeriod: "دوره بعد",
  },
} as const;

export default function VersionRoadmap({
  language,
  isRtl,
  jiraUrl,
  jiraConnected,
  versions,
  fetchingVersions,
  onRefreshVersions,
}: Props) {
  const t = copy[language];
  const [showArchived, setShowArchived] = useState(false);
  const [scaleMode, setScaleMode] = useState<RoadmapScaleMode>("fourMonth");
  const [anchorDate, setAnchorDate] = useState(() =>
    normalizeAnchor("fourMonth")
  );
  const [selected, setSelected] = useState<JiraVersion | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const visibleVersions = useMemo(
    () => (showArchived ? versions : versions.filter((v) => !v.archived)),
    [versions, showArchived]
  );

  const currentVersions = useMemo(
    () => versions.filter((v) => isCurrentVersion(v)),
    [versions]
  );

  const viewBounds = useMemo(
    () => getViewBounds(scaleMode, anchorDate),
    [scaleMode, anchorDate]
  );

  const monthlyVersions = useMemo(
    () => filterVersionsWithBoundaryInMonth(visibleVersions, anchorDate),
    [visibleVersions, anchorDate]
  );

  const periodTitle = useMemo(
    () => formatViewPeriodTitle(scaleMode, anchorDate, language),
    [scaleMode, anchorDate, language]
  );

  const openVersion = useCallback((v: JiraVersion) => {
    setSelected(v);
    setSheetOpen(true);
  }, []);

  const handleVersionUpdated = useCallback(
    (updated: JiraVersion) => {
      setSelected(updated);
      void onRefreshVersions();
    },
    [onRefreshVersions]
  );

  const handleModeChange = (values: string[]) => {
    if (!values.length) return;
    const next = values[0] as RoadmapScaleMode;
    setScaleMode(next);
    setAnchorDate(normalizeAnchor(next));
  };

  if (!jiraConnected) {
    return (
      <Empty className="border py-16" dir={isRtl ? "rtl" : "ltr"}>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <GanttChart />
          </EmptyMedia>
          <EmptyTitle>{t.notConnected}</EmptyTitle>
          <EmptyDescription>{t.notConnectedHint}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4" dir={isRtl ? "rtl" : "ltr"}>
      <Tabs defaultValue="timeline">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="timeline">{t.timeline}</TabsTrigger>
            <TabsTrigger value="current">
              {t.current}
              {currentVersions.length > 0 ? ` (${currentVersions.length})` : ""}
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Toggle
              size="sm"
              variant="outline"
              pressed={showArchived}
              onPressedChange={setShowArchived}
              aria-label={t.showArchived}
            >
              {t.showArchived}
            </Toggle>
            <Button
              size="sm"
              variant="outline"
              disabled={fetchingVersions}
              onClick={() => void onRefreshVersions()}
            >
              {t.refresh}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              {t.create}
            </Button>
          </div>
        </div>

        <TabsContent value="timeline" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              value={[scaleMode]}
              onValueChange={handleModeChange}
              variant="outline"
              size="sm"
              aria-label={t.scaleLabel}
            >
              <ToggleGroupItem value="month">{t.month}</ToggleGroupItem>
              <ToggleGroupItem value="fourMonth">{t.fourMonth}</ToggleGroupItem>
              <ToggleGroupItem value="year">{t.year}</ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-1" dir="ltr">
              <Button
                size="sm"
                variant="outline"
                aria-label={t.prevPeriod}
                onClick={() =>
                  setAnchorDate((d) => shiftAnchor(scaleMode, d, -1))
                }
              >
                <ChevronLeftIcon />
              </Button>
              <div
                className="min-w-[10rem] px-2 text-center text-sm font-medium tracking-tight"
                translate="no"
                dir={isRtl ? "rtl" : "ltr"}
              >
                {periodTitle}
              </div>
              <Button
                size="sm"
                variant="outline"
                aria-label={t.nextPeriod}
                onClick={() =>
                  setAnchorDate((d) => shiftAnchor(scaleMode, d, 1))
                }
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
          {fetchingVersions && versions.length === 0 ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-[min(70vh,40rem)] w-full" />
            </div>
          ) : visibleVersions.length === 0 ? (
            <Empty className="border py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Layers />
                </EmptyMedia>
                <EmptyTitle>{t.noVersions}</EmptyTitle>
                <EmptyDescription>{t.noVersionsHint}</EmptyDescription>
              </EmptyHeader>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusIcon data-icon="inline-start" />
                {t.create}
              </Button>
            </Empty>
          ) : scaleMode === "month" ? (
            <MonthlyVersionsPanel
              versions={monthlyVersions}
              monthAnchor={anchorDate}
              language={language}
              jiraUrl={jiraUrl}
              onOpenVersion={openVersion}
            />
          ) : (
            <VersionGantt
              versions={visibleVersions}
              language={language}
              isRtl={isRtl}
              jiraUrl={jiraUrl}
              scaleMode={scaleMode}
              viewStart={viewBounds.start}
              viewEnd={viewBounds.end}
              onOpenVersion={openVersion}
            />
          )}
        </TabsContent>

        <TabsContent value="current" className="mt-4">
          <CurrentVersionsPanel
            versions={currentVersions}
            language={language}
            jiraUrl={jiraUrl}
            onOpenVersion={openVersion}
          />
        </TabsContent>
      </Tabs>

      <VersionDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        version={selected}
        versions={versions}
        jiraUrl={jiraUrl}
        language={language}
        isRtl={isRtl}
        onVersionUpdated={handleVersionUpdated}
      />

      <CreateVersionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        language={language}
        versions={versions}
        onCreated={() => void onRefreshVersions()}
      />
    </div>
  );
}
