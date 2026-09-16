"use client";

import { Suspense, useEffect } from "react";
import { Layers, Sparkles } from "lucide-react";
import DraftInput from "@/components/DraftInput";
import RefinedList from "@/components/RefinedList";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function WorkspacePage() {
  const { t,
    isRtl,
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
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabWorkspace}</h2>
        <p className="text-sm text-muted-foreground">{t.heroSubtitle}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <h3 className="text-muted-foreground flex items-center gap-1.5 px-1 text-xs font-bold tracking-widest uppercase">
            <Sparkles className="text-primary size-4" />
            {t.draftSection}
          </h3>
          <DraftInput
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
                {"پاک کردن برد"}
              </Button>
            )}
          </div>

          <Suspense
            fallback={
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
              </div>
            }
          >
            <RefinedList
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
          </Suspense>
        </div>
      </div>
    </div>
  );
}
