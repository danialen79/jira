"use client";

import { Languages } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const { language, setLanguage, t, jiraConnected, isRtl } = useJiraApp();

  return (
    <SidebarProvider className="mx-auto max-w-[1920px]">
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
              <ThemeToggle isRtl={isRtl} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === "fa" ? "en" : "fa")}
              >
                <Languages data-icon="inline-start" />
                {language === "fa" ? "English" : "فارسی"}
              </Button>
            </div>
          </div>
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="flex flex-1 flex-col gap-5 p-4 md:p-5"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
