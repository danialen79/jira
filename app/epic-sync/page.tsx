"use client";

import { Suspense } from "react";
import EpicComponentSync from "@/components/EpicComponentSync";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Spinner } from "@/components/ui/spinner";

function EpicSyncBody() {
  const { jiraUrl, jiraConnected } = useJiraApp();
  return (
    <EpicComponentSync
      jiraUrl={jiraUrl}
      jiraConnected={jiraConnected}
    />
  );
}

export default function EpicSyncPage() {
  const { t } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabEpicSync}</h2>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        }
      >
        <EpicSyncBody />
      </Suspense>
    </div>
  );
}
