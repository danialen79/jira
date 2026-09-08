"use client";

import { useCallback, useMemo, useState } from "react";
import { GanttChart, Layers } from "lucide-react";
import type { Language, JiraVersion } from "@/lib/types";
import { isCurrentVersion } from "@/lib/roadmap";
import type { RoadmapScaleMode } from "@/lib/gantt-roadmap";
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
    noVersionsHint: "Create Fix Versions in Jira Releases.",
    notConnected: "Jira is not connected",
    notConnectedHint: "Configure Jira in Settings, then refresh.",
    refresh: "Refresh",
    scaleMonth: "Month",
    scaleQuarter: "3 mo",
    scaleHalf: "6 mo",
    scaleLabel: "Scale",
  },
  fa: {
    timeline: "رودمپ",
    current: "ورژن فعلی",
    showArchived: "نمایش بایگانی",
    noVersions: "ورژنی یافت نشد",
    noVersionsHint: "در Releases جیرا Fix Version بسازید.",
    notConnected: "جیرا متصل نیست",
    notConnectedHint: "جیرا را در Settings پیکربندی کنید.",
    refresh: "بروزرسانی",
    scaleMonth: "ماه",
    scaleQuarter: "۳ ماه",
    scaleHalf: "۶ ماه",
    scaleLabel: "مقیاس",
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
  const [scaleMode, setScaleMode] = useState<RoadmapScaleMode>("month");
  const [selected, setSelected] = useState<JiraVersion | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleVersions = useMemo(
    () => (showArchived ? versions : versions.filter((v) => !v.archived)),
    [versions, showArchived]
  );

  const currentVersions = useMemo(
    () => versions.filter((v) => isCurrentVersion(v)),
    [versions]
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

  if (!jiraConnected) {
    return (
      <Empty className="border py-16">
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
    <div className="flex flex-col gap-4">
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
          </div>
        </div>

        <TabsContent value="timeline" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              value={[scaleMode]}
              onValueChange={(values) => {
                if (!values.length) return;
                setScaleMode(values[0] as RoadmapScaleMode);
              }}
              variant="outline"
              size="sm"
              aria-label={t.scaleLabel}
            >
              <ToggleGroupItem value="month">{t.scaleMonth}</ToggleGroupItem>
              <ToggleGroupItem value="quarter">{t.scaleQuarter}</ToggleGroupItem>
              <ToggleGroupItem value="halfYear">{t.scaleHalf}</ToggleGroupItem>
            </ToggleGroup>
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
            </Empty>
          ) : (
            <VersionGantt
              versions={visibleVersions}
              language={language}
              isRtl={isRtl}
              jiraUrl={jiraUrl}
              scaleMode={scaleMode}
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
    </div>
  );
}
