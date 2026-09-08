import { NextResponse } from "next/server";
import { getAppMeta, setAppMeta } from "@/lib/db/repos/settings";
import { updateAiSettings, type AIProvider } from "@/lib/db/repos/ai";
import { setKv } from "@/lib/db/repos/kv";
import { replaceAllCustomPrompts } from "@/lib/db/repos/prompts";
import { replaceRecentWorklogs } from "@/lib/db/repos/recent-logs";

const MIGRATED_KEY = "local_storage_migrated";

function isAIProvider(value: unknown): value is AIProvider {
  return value === "gemini" || value === "avalai" || value === "arvan";
}

export async function POST(request: Request) {
  try {
    if (getAppMeta(MIGRATED_KEY) === "1") {
      return NextResponse.json({
        ok: true,
        alreadyMigrated: true,
      });
    }

    const body = await request.json().catch(() => ({}));

    if (body?.aiProvider || body?.aiModel || body?.defaultModels) {
      const defaultProvider = isAIProvider(body.aiProvider)
        ? body.aiProvider
        : undefined;
      const defaultModels: Record<string, string> = {};
      if (defaultProvider && body.aiModel) {
        defaultModels[defaultProvider] = String(body.aiModel);
      }
      if (body.defaultModels && typeof body.defaultModels === "object") {
        Object.assign(defaultModels, body.defaultModels);
      }
      updateAiSettings({
        defaultProvider,
        defaultModels: defaultModels as any,
      });
    }

    if (Array.isArray(body?.customPrompts) && body.customPrompts.length > 0) {
      replaceAllCustomPrompts(
        body.customPrompts.map((p: any) => ({
          id: String(p.id || crypto.randomUUID()),
          name: String(p.name || ""),
          prompt: String(p.prompt || ""),
          description: String(p.desc || p.description || ""),
        }))
      );
    }

    if (typeof body?.lastDraft === "string") {
      setKv("workspace", "last_draft", { text: body.lastDraft });
    }

    if (body?.refinedIssues !== undefined) {
      setKv("workspace", "refined_issues", body.refinedIssues);
    }

    if (typeof body?.manualComponents === "string") {
      setKv("workspace", "manual_components", { text: body.manualComponents });
    }

    if (
      body?.assigneeFrequency &&
      typeof body.assigneeFrequency === "object"
    ) {
      setKv("prefs", "assignee_frequency", body.assigneeFrequency);
    }

    if (Array.isArray(body?.recentLogs) && body.recentLogs.length > 0) {
      replaceRecentWorklogs(
        body.recentLogs.map((log: any) => ({
          issueKey: String(log.issueKey || ""),
          summary: String(log.summary || ""),
          parentKey: log.parentKey ? String(log.parentKey) : undefined,
          timeSpent: String(log.timeSpent || ""),
          comment: String(log.comment || ""),
          url: String(log.url || ""),
          timestamp: log.timestamp ? String(log.timestamp) : undefined,
        }))
      );
    }

    setAppMeta(MIGRATED_KEY, "1");

    return NextResponse.json({ ok: true, migrated: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Migration failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      migrated: getAppMeta(MIGRATED_KEY) === "1",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to check migration status" },
      { status: 500 }
    );
  }
}
