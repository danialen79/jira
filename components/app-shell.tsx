"use client";

import { TicketIcon } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { IssuePeekDock } from "@/components/issue-peek/IssuePeekDock";
import { ThemeToggle } from "@/components/theme-toggle";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t, jiraConnected } = useJiraApp();
  const { expandAndFocusSearch, issueKey } = useIssuePeek();

  return (
    <SidebarProvider className="mx-auto max-w-[2560px]">
      <AppSidebar />
      <SidebarInset>
        <header className="bg-background sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="me-2 h-4" />
          <div className="flex flex-1 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{t.heroTitle}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t.heroSubtitle}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={expandAndFocusSearch}
                aria-label="پنل ایشو"
                title="پنل ایشو (Ctrl+Shift+J)"
              >
                <TicketIcon data-icon="inline-start" />
                <span className="hidden sm:inline">{issueKey || "ایشو"}</span>
              </Button>
              <Badge
                variant={jiraConnected ? "success" : "secondary"}
                className="hidden sm:inline-flex"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    jiraConnected ? "bg-success" : "bg-muted-foreground"
                  )}
                />
                {jiraConnected ? t.connected : t.disconnected}
              </Badge>
              <ThemeToggle />
            </div>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 flex-row" dir="ltr">
          <IssuePeekDock />
          <div
            id="main-content"
            tabIndex={-1}
            className="flex min-w-0 flex-1 flex-col gap-5 overflow-auto p-4 md:p-5"
            dir="rtl"
          >
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
