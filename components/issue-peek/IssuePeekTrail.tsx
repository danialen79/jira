"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const t = {
    trail: "مسیر ایشو",
    back: "بازگشت",
    more: "بیشتر",
  } as const;

type Props = { className?: string };

export function IssuePeekTrail({ className }: Props) {
  const { isRtl } = useJiraApp();  const { navStack, openIssue, issueKey } = useIssuePeek();

  if (navStack.length <= 1) return null;

  const head = navStack.slice(0, -1);
  const current = navStack[navStack.length - 1];
  const showCollapse = head.length > 2;
  const visibleHead = showCollapse ? head.slice(-1) : head;
  const hidden = showCollapse ? head.slice(0, -1) : [];

  const BackIcon = isRtl ? ChevronRightIcon : ChevronLeftIcon;

  return (
    <nav
      aria-label={t.trail}
      className={cn(
        "flex min-w-0 items-center gap-1 border-b px-3 py-1.5",
        className
      )}
      dir="rtl"
    >
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label={t.back}
        title={t.back}
        className="shrink-0"
        onClick={() => {
          const prev = navStack[navStack.length - 2];
          if (prev) openIssue(prev);
        }}
      >
        <BackIcon />
      </Button>

      <ol className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden text-[11px]">
        {hidden.length > 0 ? (
          <li className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-1.5 text-[11px] text-muted-foreground"
                  />
                }
              >
                {t.more}…
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                <DropdownMenuGroup>
                  {hidden.map((key) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => openIssue(key)}
                    >
                      <span className="font-mono" translate="no">
                        {key}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="mx-0.5 text-muted-foreground" aria-hidden>
              /
            </span>
          </li>
        ) : null}

        {visibleHead.map((key) => (
          <li key={key} className="flex min-w-0 shrink items-center gap-0.5">
            <button
              type="button"
              className="min-w-0 cursor-pointer truncate rounded px-1 py-0.5 font-mono text-primary hover:bg-muted hover:underline"
              translate="no"
              onClick={() => openIssue(key)}
            >
              {key}
            </button>
            <span className="shrink-0 text-muted-foreground" aria-hidden>
              /
            </span>
          </li>
        ))}

        <li className="min-w-0 shrink truncate">
          <span
            className="rounded px-1 py-0.5 font-mono font-medium text-foreground"
            translate="no"
            aria-current="page"
          >
            {current || issueKey}
          </span>
        </li>
      </ol>
    </nav>
  );
}
