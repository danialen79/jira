"use client";

import { BookMarked, Check, Globe, PenLine, Ticket, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import type { AgentActivityItem } from "@/lib/ai/agents/activity";

function ToolIcon({ tool }: { tool: AgentActivityItem["tool"] }) {
  if (tool === "consultJira")
    return <Ticket className="size-3" aria-hidden="true" />;
  if (tool === "consultWeb")
    return <Globe className="size-3" aria-hidden="true" />;
  if (tool === "consultKnowledge" || tool === "consultBrief") {
    return <BookMarked className="size-3" aria-hidden="true" />;
  }
  if (tool === "proposeStories")
    return <PenLine className="size-3" aria-hidden="true" />;
  return null;
}

export function AgentActivityRail({
  items,
  className,
}: {
  items: AgentActivityItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <div
      className={cn(
        "bg-muted/40 flex min-w-0 flex-col gap-1.5 rounded-lg border px-3 py-2",
        className
      )}
      aria-live="polite"
      aria-label="فعالیت ایجنت"
    >
      <p className="text-muted-foreground text-[10px]">ایجنت‌ها</p>
      <ul className="flex min-w-0 flex-col gap-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex min-w-0 items-center gap-2 text-xs"
          >
            <span className="text-muted-foreground shrink-0">
              {item.state === "running" ? (
                <Spinner className="size-3" />
              ) : item.state === "error" ? (
                <X className="text-destructive size-3" aria-hidden="true" />
              ) : (
                <Check className="size-3 text-emerald-600" aria-hidden="true" />
              )}
            </span>
            <ToolIcon tool={item.tool} />
            <span className="shrink-0 font-medium">{item.label}</span>
            {item.detail ? (
              <span className="text-muted-foreground min-w-0 truncate">
                {item.detail}
              </span>
            ) : null}
            <span className="text-muted-foreground ms-auto shrink-0 text-[10px]">
              {item.state === "running"
                ? "در حال…"
                : item.state === "error"
                  ? "خطا"
                  : "انجام"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
