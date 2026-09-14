"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type IssueMetaItem = {
  icon?: LucideIcon;
  label: ReactNode;
  key?: string;
};

type Props = {
  items: IssueMetaItem[];
  className?: string;
};

/** Description-hierarchy meta: icon + label items joined by `|`. */
export function IssueMetaLine({ items, className }: Props) {
  const visible = items.filter((item) => {
    if (item.label == null || item.label === false) return false;
    if (typeof item.label === "string" && !item.label.trim()) return false;
    return true;
  });
  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      {visible.map((item, i) => {
        const Icon = item.icon;
        return (
          <span key={item.key ?? i} className="inline-flex min-w-0 items-center gap-1.5">
            {i > 0 ? (
              <span className="text-muted-foreground/70" aria-hidden>
                |
              </span>
            ) : null}
            {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
            <span className="min-w-0 truncate">{item.label}</span>
          </span>
        );
      })}
    </div>
  );
}
