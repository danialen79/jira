"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useIssuePeekOptional } from "@/components/providers/issue-peek-provider";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  issueKey: string;
  className?: string;
  showIcon?: boolean;
};

/**
 * Issue key control: opens Issue Peek when available;
 * external icon (or Ctrl/Meta+click on key) opens Jira browse.
 */
export function IssueKeyLink({
  href,
  issueKey,
  className,
  showIcon = true,
}: Props) {
  const peek = useIssuePeekOptional();

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-mono text-xs font-medium",
        className
      )}
      translate="no"
    >
      <button
        type="button"
        className="cursor-pointer text-primary underline-offset-2 hover:underline"
        onClick={(e) => {
          e.stopPropagation();
          if (e.metaKey || e.ctrlKey) {
            window.open(href, "_blank", "noopener,noreferrer");
            return;
          }
          if (peek) {
            peek.openIssue(issueKey, { replace: true });
            return;
          }
          window.open(href, "_blank", "noopener,noreferrer");
        }}
      >
        {issueKey}
      </button>
      {showIcon ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary opacity-60 hover:opacity-100"
          aria-label={`Open ${issueKey} in Jira`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLinkIcon className="size-3" aria-hidden />
        </a>
      ) : null}
    </span>
  );
}
