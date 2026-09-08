"use client";

import MyDailyBoard from "@/components/MyDailyBoard";
import { useJiraApp } from "@/components/providers/jira-app-provider";

export default function DailyBoardPage() {
  const { language, t, jiraUrl, jiraUsername, jiraConnected, jiraUsers } =
    useJiraApp();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabDailyBoard}</h2>
      </div>
      <MyDailyBoard
        language={language}
        jiraUrl={jiraUrl}
        jiraUsername={jiraUsername}
        jiraConnected={jiraConnected}
        jiraUsers={jiraUsers}
      />
    </div>
  );
}
