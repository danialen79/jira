"use client";

import { useEffect, useState } from "react";
import { HistoryIcon, SearchIcon } from "lucide-react";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isValidIssueKey,
  normalizeIssueKey,
} from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
    placeholder: "PROJ-123…",
    fetch: "بارگذاری",
    invalid: "فرمت KEY-123",
    recent: "اخیر",
  } as const;

type Props = {
  className?: string;
};

export function IssuePeekSearch({ className }: Props) {
  const { isRtl } = useJiraApp();  const { issueKey, openIssue, recentKeys, loading } = useIssuePeek();
  const [value, setValue] = useState(issueKey || "");
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    setValue(issueKey || "");
  }, [issueKey]);

  const submit = () => {
    const key = normalizeIssueKey(value);
    if (!isValidIssueKey(key)) return;
    openIssue(key, { replace: true });
    setShowRecent(false);
  };

  return (
    <div className={cn("relative flex flex-col gap-1.5", className)} dir="rtl">
      <div className="flex gap-1.5">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="issue-peek-search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setShowRecent(true)}
            onBlur={() => {
              window.setTimeout(() => setShowRecent(false), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={t.placeholder}
            spellCheck={false}
            autoComplete="off"
            name="issue-peek-key"
            translate="no"
            className="ps-8 font-mono text-xs uppercase"
            aria-label={t.placeholder}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={loading || !isValidIssueKey(value)}
        >
          {t.fetch}
        </Button>
      </div>
      {value && !isValidIssueKey(value) ? (
        <p className="text-[11px] text-destructive">{t.invalid}</p>
      ) : null}
      {showRecent && recentKeys.length > 0 ? (
        <div className="absolute start-0 end-0 top-full z-20 mt-1 rounded-md border bg-popover p-1 shadow-md">
          <p className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground">
            <HistoryIcon className="size-3" aria-hidden />
            {t.recent}
          </p>
          <ul className="max-h-40 overflow-y-auto">
            {recentKeys.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  className="w-full cursor-pointer rounded-sm px-2 py-1.5 text-start font-mono text-xs hover:bg-muted"
                  translate="no"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setValue(k);
                    openIssue(k, { replace: true });
                    setShowRecent(false);
                  }}
                >
                  {k}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
