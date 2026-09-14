"use client";

import { Suspense } from "react";
import IssueOpsBoard from "@/components/IssueOpsBoard";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Spinner } from "@/components/ui/spinner";

export default function OpsPage() {
  const { t } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-pretty">
          {t.tabOps}
        </h2>
      </div>
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
          </div>
        }
      >
        <IssueOpsBoard />
      </Suspense>
    </div>
  );
}
