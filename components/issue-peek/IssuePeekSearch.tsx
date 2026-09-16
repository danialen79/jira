"use client";

import { useEffect, useState } from "react";
import { HistoryIcon, SearchIcon } from "lucide-react";
import { useIssuePeek } from "@/components/providers/issue-peek-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isValidIssueKey,
  parseIssueKeyInput,
} from "@/lib/issue-peek";
import { cn } from "@/lib/utils";

const t = {
  placeholder: "SIP-123 یا لینک جیرا…",
  fetch: "بارگذاری",
  invalid: "فرمت KEY-123",
  recent: "اخیر",
  ariaLabel: "کلید ایشو",
} as const;

type Props = {
  className?: string;
};

export function IssuePeekSearch({ className }: Props) {
  const { issueKey, openIssue, recentIssues, loading } = useIssuePeek();
  const [value, setValue] = useState(issueKey || "");
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    setValue(issueKey || "");
  }, [issueKey]);

  const parsed = parseIssueKeyInput(value);
  const canSubmit = isValidIssueKey(parsed);

  const submit = () => {
    if (!canSubmit) return;
    openIssue(parsed, { replace: true });
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
            className="ps-8 font-mono text-xs"
            aria-label={t.ariaLabel}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={submit}
          disabled={loading || !canSubmit}
        >
          {t.fetch}
        </Button>
      </div>
      {value && !canSubmit ? (
        <p className="text-[11px] text-destructive" role="alert">
          {t.invalid}
        </p>
      ) : null}
      {showRecent && recentIssues.length > 0 ? (
        <div className="absolute start-0 end-0 top-full z-20 mt-1 rounded-md border bg-popover p-1 shadow-md">
          <p className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground">
            <HistoryIcon className="size-3" aria-hidden />
            {t.recent}
          </p>
          <ul className="max-h-48 overflow-y-auto">
            {recentIssues.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer flex-col gap-0.5 rounded-sm px-2 py-1.5 text-start hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setValue(item.key);
                    openIssue(item.key, { replace: true });
                    setShowRecent(false);
                  }}
                >
                  <span className="font-mono text-xs" translate="no">
                    {item.key}
                  </span>
                  {item.summary ? (
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">
                      {item.summary}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
