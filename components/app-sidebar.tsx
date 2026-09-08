"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ClipboardList,
  MessageSquare,
  Sparkles,
  Tag,
} from "lucide-react";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const navItems = [
  {
    href: "/health",
    icon: Activity,
    labelKey: "tabHealth" as const,
  },
  {
    href: "/workspace",
    icon: Sparkles,
    labelKey: "tabWorkspace" as const,
    showBadge: true,
  },
  {
    href: "/daily-board",
    icon: ClipboardList,
    labelKey: "tabDailyBoard" as const,
  },
  {
    href: "/mattermost",
    icon: MessageSquare,
    labelKey: "tabMattermost" as const,
  },
  {
    href: "/epic-sync",
    icon: Tag,
    labelKey: "tabEpicSync" as const,
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { t, isRtl, issues, jiraConnected } = useJiraApp();

  return (
    <Sidebar
      side={isRtl ? "right" : "left"}
      collapsible="icon"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/health" />}>
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Sparkles className="size-4" />
              </div>
              <div className="grid flex-1 text-start text-sm leading-tight">
                <span className="truncate font-semibold">
                  {isRtl ? "جیرا AI" : "Jira AI"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  Self-Host
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {isRtl ? "منو" : "Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={t[item.labelKey]}
                      render={<Link href={item.href} />}
                    >
                      <Icon />
                      <span>{t[item.labelKey]}</span>
                    </SidebarMenuButton>
                    {"showBadge" in item &&
                      item.showBadge &&
                      issues.length > 0 && (
                        <SidebarMenuBadge>{issues.length}</SidebarMenuBadge>
                      )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
          <span
            className={
              jiraConnected
                ? "size-2 rounded-full bg-success"
                : "size-2 rounded-full bg-muted-foreground/40"
            }
          />
          <span className="truncate">
            {t.jiraStatus}: {jiraConnected ? t.connected : t.disconnected}
          </span>
        </div>
        {!jiraConnected && (
          <Badge variant="secondary" className="mx-2 mb-2 w-fit">
            {t.disconnected}
          </Badge>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
