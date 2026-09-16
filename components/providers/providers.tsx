"use client";

import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { AiSettingsProvider } from "@/components/providers/ai-settings-provider";
import { IssuePeekProvider } from "@/components/providers/issue-peek-provider";
import { JiraAppProvider } from "@/components/providers/jira-app-provider";
import { LocalStorageMigrator } from "@/components/providers/local-storage-migrator";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <LocalStorageMigrator>
          <JiraAppProvider>
            <AiSettingsProvider>
              <Suspense fallback={null}>
                <IssuePeekProvider>
                  <AppShell>{children}</AppShell>
                </IssuePeekProvider>
              </Suspense>
              <Toaster richColors position="top-center" />
            </AiSettingsProvider>
          </JiraAppProvider>
        </LocalStorageMigrator>
      </TooltipProvider>
    </ThemeProvider>
  );
}
