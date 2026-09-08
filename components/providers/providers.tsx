"use client";

import { ThemeProvider } from "next-themes";
import { JiraAppProvider } from "@/components/providers/jira-app-provider";
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
        <JiraAppProvider>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="top-center" />
        </JiraAppProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
