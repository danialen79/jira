"use client";

import { Suspense, useEffect } from "react";
import MatrixBoard from "@/components/matrix/MatrixBoard";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Spinner } from "@/components/ui/spinner";

function MatrixBody() {
  const {
    jiraConnected,
    jiraVersions,
    fetchingVersions,
    fetchJiraVersions,
    config,
  } = useJiraApp();

  useEffect(() => {
    if (jiraConnected && jiraVersions.length === 0 && !fetchingVersions) {
      void fetchJiraVersions();
    }
  }, [
    jiraConnected,
    jiraVersions.length,
    fetchingVersions,
    fetchJiraVersions,
  ]);

  const fieldsConfigured = Boolean(
    config.impactFieldId && config.effortFieldId
  );

  return (
    <MatrixBoard
      versions={jiraVersions}
      jiraConnected={jiraConnected}
      fieldsConfigured={fieldsConfigured}
    />
  );
}

export default function MatrixPage() {
  const { t } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-pretty">
          {t.tabMatrix}
        </h2>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        }
      >
        <MatrixBody />
      </Suspense>
    </div>
  );
}
