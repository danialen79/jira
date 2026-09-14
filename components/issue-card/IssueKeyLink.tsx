"use client";

import { ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  issueKey: string;
  className?: string;
  showIcon?: boolean;
};

/** Jira issue key as an external browse link (new tab). */
export function IssueKeyLink({
  href,
  issueKey,
  className,
  showIcon = true,
}: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      translate="no"
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs font-medium text-primary underline-offset-2 hover:underline",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {issueKey}
      {showIcon ? (
        <ExternalLinkIcon className="size-3 opacity-60" aria-hidden />
      ) : null}
    </a>
  );
}
