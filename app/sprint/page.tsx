"use client";

import { Suspense } from "react";
import SprintControlCenter from "@/components/sprint/SprintControlCenter";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Spinner } from "@/components/ui/spinner";

function SprintBody() {
  const { language, isRtl, jiraUrl, jiraConnected } = useJiraApp();

  return (
    <SprintControlCenter
      language={language}
      isRtl={isRtl}
      jiraUrl={jiraUrl}
      jiraConnected={jiraConnected}
    />
  );
}

export default function SprintPage() {
  const { t } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabSprint}</h2>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        }
      >
        <SprintBody />
      </Suspense>
    </div>
  );
}
