"use client";

import SupportInbox from "@/components/support/SupportInbox";
import { useJiraApp } from "@/components/providers/jira-app-provider";

export default function SupportPage() {
  const { t } = useJiraApp();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold tracking-tight">{t.tabSupport}</h2>
        <p className="text-sm text-muted-foreground">{t.supportSubtitle}</p>
      </div>
      <SupportInbox />
    </div>
  );
}
