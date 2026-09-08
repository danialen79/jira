"use client";

import { useEffect, useRef, useState } from "react";

const LEGACY_KEYS = [
  "jira_ai_provider",
  "jira_ai_model",
  "jira_last_selected_model",
  "jira_selected_gemini_model",
  "jira_custom_prompts",
  "jira_last_draft_text",
  "jira_refined_issues",
  "jira_manual_components",
  "jira_assignee_frequency",
  "jira_recent_logs",
] as const;

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * One-shot migration of legacy browser localStorage into server SQLite.
 * Gates children until the migration attempt finishes so hydrate reads DB.
 */
export function LocalStorageMigrator({
  children,
}: {
  children: React.ReactNode;
}) {
  const ran = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const statusRes = await fetch("/api/storage/migrate-local");
        if (statusRes.ok) {
          const status = await statusRes.json();
          if (status.migrated) {
            for (const key of LEGACY_KEYS) {
              localStorage.removeItem(key);
            }
            setReady(true);
            return;
          }
        }

        const aiProvider = localStorage.getItem("jira_ai_provider");
        const aiModel =
          localStorage.getItem("jira_ai_model") ||
          localStorage.getItem("jira_last_selected_model") ||
          localStorage.getItem("jira_selected_gemini_model");

        const payload = {
          aiProvider:
            aiProvider === "gemini" ||
            aiProvider === "avalai" ||
            aiProvider === "arvan"
              ? aiProvider
              : undefined,
          aiModel: aiModel || undefined,
          customPrompts: safeParse<any[]>(
            localStorage.getItem("jira_custom_prompts")
          ),
          lastDraft: localStorage.getItem("jira_last_draft_text") || undefined,
          refinedIssues: safeParse(
            localStorage.getItem("jira_refined_issues")
          ),
          manualComponents:
            localStorage.getItem("jira_manual_components") || undefined,
          assigneeFrequency: safeParse(
            localStorage.getItem("jira_assignee_frequency")
          ),
          recentLogs: safeParse<any[]>(
            localStorage.getItem("jira_recent_logs")
          ),
        };

        const hasAnything =
          payload.aiProvider ||
          payload.aiModel ||
          (payload.customPrompts && payload.customPrompts.length > 0) ||
          payload.lastDraft ||
          payload.refinedIssues ||
          payload.manualComponents ||
          payload.assigneeFrequency ||
          (payload.recentLogs && payload.recentLogs.length > 0);

        const res = await fetch("/api/storage/migrate-local", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(hasAnything ? payload : {}),
        });

        if (res.ok) {
          for (const key of LEGACY_KEYS) {
            localStorage.removeItem(key);
          }
        }
      } catch (e) {
        console.error("localStorage migration failed", e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) return null;
  return <>{children}</>;
}
