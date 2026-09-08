"use client";

import { Suspense } from "react";
import VersionRoadmap from "@/components/VersionRoadmap";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Spinner } from "@/components/ui/spinner";

function RoadmapBody() {
  const {
    language,
    isRtl,
    jiraUrl,
    jiraConnected,
    jiraVersions,
    fetchingVersions,
    fetchJiraVersions,
  } = useJiraApp();

  return (
    <VersionRoadmap
      language={language}
      isRtl={isRtl}
      jiraUrl={jiraUrl}
      jiraConnected={jiraConnected}
      versions={jiraVersions}
      fetchingVersions={fetchingVersions}
      onRefreshVersions={fetchJiraVersions}
    />
  );
}

export default function RoadmapPage() {
  const { t } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabRoadmap}</h2>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        }
      >
        <RoadmapBody />
      </Suspense>
    </div>
  );
}
