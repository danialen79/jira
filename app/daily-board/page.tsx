"use client";

import { Suspense } from "react";
import MyDailyBoard from "@/components/MyDailyBoard";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Spinner } from "@/components/ui/spinner";

function DailyBoardBody() {
  const { jiraUrl, jiraUsername, jiraConnected, jiraUsers } =
    useJiraApp();

  return (
    <MyDailyBoard
      jiraUrl={jiraUrl}
      jiraUsername={jiraUsername}
      jiraConnected={jiraConnected}
      jiraUsers={jiraUsers}
    />
  );
}

export default function DailyBoardPage() {
  const { t } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabDailyBoard}</h2>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        }
      >
        <DailyBoardBody />
      </Suspense>
    </div>
  );
}
