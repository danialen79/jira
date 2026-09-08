"use client";

import { ThemeProvider } from "next-themes";
import { AiSettingsProvider } from "@/components/providers/ai-settings-provider";
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
              <AppShell>{children}</AppShell>
              <Toaster richColors position="top-center" />
            </AiSettingsProvider>
          </JiraAppProvider>
        </LocalStorageMigrator>
      </TooltipProvider>
    </ThemeProvider>
  );
}
