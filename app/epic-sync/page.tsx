"use client";

import EpicComponentSync from "@/components/EpicComponentSync";
import { useJiraApp } from "@/components/providers/jira-app-provider";

export default function EpicSyncPage() {
  const { language, t, jiraUrl, jiraConnected } = useJiraApp();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabEpicSync}</h2>
      </div>
      <EpicComponentSync
        language={language}
        jiraUrl={jiraUrl}
        jiraConnected={jiraConnected}
      />
    </div>
  );
}
