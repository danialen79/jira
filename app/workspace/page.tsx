"use client";

import { useEffect } from "react";
import { Layers, Sparkles } from "lucide-react";
import DraftInput from "@/components/DraftInput";
import RefinedList from "@/components/RefinedList";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";

export default function WorkspacePage() {
  const {
    language,
    isRtl,
    t,
    handleRefine,
    refining,
    importedDraftText,
    issues,
    setIssues,
    clearIssues,
    jiraUrl,
    jiraConnected,
    existingEpics,
    fetchExistingEpics,
    fetchingEpics,
    componentNames,
    jiraUsers,
    fetchingUsers,
    fetchJiraUsers,
    jiraVersions,
    fetchingVersions,
    fetchJiraVersions,
    jiraSprints,
    fetchingSprints,
    fetchJiraSprints,
    refreshWorkspaceMeta,
  } = useJiraApp();

  useEffect(() => {
    refreshWorkspaceMeta();
  }, [refreshWorkspaceMeta]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabWorkspace}</h2>
        <p className="text-sm text-muted-foreground">{t.heroSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <h3 className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs font-bold tracking-widest uppercase">
            <Sparkles className="text-primary size-4" />
            {t.draftSection}
          </h3>
          <DraftInput
            language={language}
            onRefine={handleRefine}
            loading={refining}
            draftText={importedDraftText}
          />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase">
              <Layers className="text-primary size-4" />
              {t.boardSection}
            </h3>
            {issues.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearIssues}
                className="text-muted-foreground hover:text-destructive"
              >
                {isRtl ? "پاک کردن برد" : "Clear Board"}
              </Button>
            )}
          </div>

          <RefinedList
            language={language}
            issues={issues}
            onIssuesChange={setIssues}
            jiraUrl={jiraUrl}
            jiraConnected={jiraConnected}
            existingEpics={existingEpics}
            onFetchEpics={fetchExistingEpics}
            fetchingEpics={fetchingEpics}
            availableComponents={componentNames}
            availableUsers={jiraUsers}
            fetchingUsers={fetchingUsers}
            onFetchUsers={fetchJiraUsers}
            availableVersions={jiraVersions}
            fetchingVersions={fetchingVersions}
            onFetchVersions={fetchJiraVersions}
            availableSprints={jiraSprints}
            fetchingSprints={fetchingSprints}
            onFetchSprints={fetchJiraSprints}
          />
        </div>
      </div>
    </div>
  );
}
