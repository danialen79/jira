"use client";

import { Suspense, useEffect, useState } from "react";
import DraftInput from "@/components/DraftInput";
import RefinedList from "@/components/RefinedList";
import WorkshopInterview from "@/components/workshop/WorkshopInterview";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { RefinedIssue } from "@/lib/types";

export default function WorkspacePage() {
  const {
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

  const [mode, setMode] = useState<"interview" | "quick">("interview");

  useEffect(() => {
    refreshWorkspaceMeta();
  }, [refreshWorkspaceMeta]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            {t.tabWorkspace}
          </h2>
          <ToggleGroup
            value={[mode]}
            onValueChange={(values) => {
              if (!values.length) return;
              const next = values[0];
              if (next === "interview" || next === "quick") setMode(next);
            }}
            variant="outline"
            size="sm"
            className="w-fit"
          >
            <ToggleGroupItem value="interview">مصاحبه</ToggleGroupItem>
            <ToggleGroupItem value="quick">اصلاح سریع</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        <section className="flex min-h-[50dvh] flex-col lg:col-span-5 lg:min-h-0">
          <p className="text-muted-foreground mb-2 shrink-0 px-1 text-sm">
            {t.draftSection}
          </p>
          {mode === "interview" ? (
            <WorkshopInterview
              onIssuesReady={(next: RefinedIssue[]) => setIssues(next)}
              className="min-h-0 flex-1"
            />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DraftInput
                onRefine={handleRefine}
                loading={refining}
                draftText={importedDraftText}
              />
            </div>
          )}
        </section>

        <section className="flex min-h-[50dvh] flex-col lg:col-span-7 lg:min-h-0">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-2 px-1">
            <p className="text-muted-foreground text-sm">{t.boardSection}</p>
            {issues.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearIssues}
                className="text-muted-foreground hover:text-destructive"
              >
                پاک کردن برد
              </Button>
            ) : null}
          </div>

          <Suspense
            fallback={
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Spinner />
              </div>
            }
          >
            <RefinedList
              className="min-h-0 flex-1"
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
        </section>
      </div>
    </div>
  );
}
