import { NextResponse } from "next/server";
import { getBulkActionDef } from "@/lib/issue-ops/actions";
import type { BulkActionId, BulkActionResult } from "@/lib/issue-ops/types";
import { isStoryLens } from "@/lib/lens";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import {
  writeIssueAssignee,
  writeIssueFixVersion,
  writeIssueLens,
  writeIssueStatusTransition,
} from "@/lib/jira-issue-writes";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body.action as BulkActionId;
    const issueKeys: unknown = body.issueKeys;
    const params = body.params || {};

    if (!getBulkActionDef(action)) {
      return NextResponse.json(
        { error: "Unknown or unsupported bulk action." },
        { status: 400 }
      );
    }
    if (!Array.isArray(issueKeys) || issueKeys.length === 0) {
      return NextResponse.json(
        { error: "issueKeys must be a non-empty array." },
        { status: 400 }
      );
    }

    const keys = issueKeys
      .map((k) => String(k || "").trim())
      .filter(Boolean);
    if (keys.length === 0) {
      return NextResponse.json(
        { error: "issueKeys must be a non-empty array." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const client = { jiraUrl, headers };
    const epicLinkField = config.epicLinkField || "customfield_10014";
    const results: BulkActionResult[] = [];

    for (const issueKey of keys) {
      try {
        if (action === "setLens") {
          if (!isStoryLens(params.lens)) {
            results.push({
              issueKey,
              success: false,
              error: "Invalid lens.",
            });
            continue;
          }
          const r = await writeIssueLens(client, issueKey, params.lens);
          results.push({
            issueKey,
            success: r.ok,
            skipped: !r.ok && "skipped" in r ? r.skipped : undefined,
            error: r.ok ? undefined : r.error,
          });
        } else if (action === "setAssignee") {
          const assignee =
            params.assignee === null || params.assignee === ""
              ? null
              : String(params.assignee);
          const r = await writeIssueAssignee(client, issueKey, assignee);
          results.push({
            issueKey,
            success: r.ok,
            error: r.ok ? undefined : r.error,
          });
        } else if (action === "setFixVersion") {
          const fixVersionId = String(params.fixVersionId || "").trim();
          if (!fixVersionId) {
            results.push({
              issueKey,
              success: false,
              error: "fixVersionId is required.",
            });
            continue;
          }
          const r = await writeIssueFixVersion(
            client,
            issueKey,
            fixVersionId,
            epicLinkField
          );
          results.push({
            issueKey,
            success: r.ok,
            skipped: !r.ok && "skipped" in r ? r.skipped : undefined,
            error: r.ok ? undefined : r.error,
          });
        } else if (action === "setStatus") {
          const statusName = String(params.statusName || "").trim();
          if (!statusName) {
            results.push({
              issueKey,
              success: false,
              error: "statusName is required.",
            });
            continue;
          }
          const r = await writeIssueStatusTransition(
            client,
            issueKey,
            statusName
          );
          results.push({
            issueKey,
            success: r.ok,
            skipped: !r.ok && "skipped" in r ? r.skipped : undefined,
            error: r.ok ? undefined : r.error,
          });
        }
      } catch (err: unknown) {
        results.push({
          issueKey,
          success: false,
          error: err instanceof Error ? err.message : "Update failed",
        });
      }
    }

    const updatedCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: true,
      updatedCount,
      totalRequested: keys.length,
      results,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Bulk Issues Update Error:", err);
    const message = err instanceof Error ? err.message : "Bulk update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
