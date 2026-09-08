"use client";

import MattermostIntegration from "@/components/MattermostIntegration";
import { useJiraApp } from "@/components/providers/jira-app-provider";

export default function MattermostPage() {
  const { language, t, handleImportMattermostDraft } = useJiraApp();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabMattermost}</h2>
      </div>
      <MattermostIntegration
        language={language}
        onImportDraft={handleImportMattermostDraft}
      />
    </div>
  );
}
