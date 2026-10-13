import { NextResponse } from "next/server";
import { generateAIJson } from "@/lib/ai-provider";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { canHaveSubtasks } from "@/lib/issue-ops/map";
import {
  buildSubtaskBulkSystemInstruction,
  heuristicSplitSubtasks,
  normalizePlanItems,
  type SubtaskDraftRow,
} from "@/lib/subtask-bulk";

async function fetchExistingSubtasks(
  jiraUrl: string,
  headers: Record<string, string>,
  parentKey: string
): Promise<{ key: string; summary: string; assignee?: string }[]> {
  const jql = `parent = ${parentKey} ORDER BY key ASC`;
  const response = await fetch(`${jiraUrl}/rest/api/2/search`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      jql,
      startAt: 0,
      maxResults: 100,
      fields: ["summary", "assignee"],
    }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.issues || []).map((raw: any) => ({
    key: raw.key as string,
    summary: raw.fields?.summary || "",
    assignee: raw.fields?.assignee?.name as string | undefined,
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parentKey = String(body.parentKey || "")
      .trim()
      .toUpperCase();
    const rawText = String(body.rawText || "").trim();
    const defaultAssignee = String(body.defaultAssignee || "").trim();
    const provider = body.provider;
    const model = body.model;

    if (!parentKey) {
      return NextResponse.json(
        { error: "parentKey is required." },
        { status: 400 }
      );
    }
    if (!rawText) {
      return NextResponse.json(
        { error: "rawText is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();

    const parentRes = await fetch(
      `${jiraUrl}/rest/api/2/issue/${encodeURIComponent(parentKey)}?fields=summary,issuetype`,
      { headers }
    );
    if (!parentRes.ok) {
      const text = await parentRes.text();
      return NextResponse.json(
        { error: `Parent issue not found (${parentRes.status}): ${text}` },
        { status: parentRes.status === 404 ? 404 : 502 }
      );
    }
    const parentData = await parentRes.json();
    const parentSummary = parentData.fields?.summary || "";
    const parentType = parentData.fields?.issuetype?.name || "Story";

    if (!canHaveSubtasks(parentType)) {
      return NextResponse.json(
        { error: "This issue type cannot have sub-tasks." },
        { status: 400 }
      );
    }

    const existing = await fetchExistingSubtasks(jiraUrl, headers, parentKey);
    const existingLines = existing
      .map((s) => `- ${s.key}: ${s.summary}`)
      .join("\n");

    const usersList = Array.isArray(body.teamUsers)
      ? (body.teamUsers as { name?: string; displayName?: string }[])
          .map((u) => `${u.name || ""} (${u.displayName || ""})`.trim())
          .filter(Boolean)
          .join(", ")
      : "";

    const userPrompt = `Parent issue (fixed — all sub-tasks belong here):
Key: ${parentKey}
Type: ${parentType}
Summary: ${parentSummary}

Existing sub-tasks (avoid duplicates; set duplicateOfExistingKey when same):
${existingLines || "(none)"}

Team usernames for assignee hints (optional):
${usersList || "(not provided)"}

Default assignee username if none inferred: ${defaultAssignee || "(empty)"}

User dump:
"""
${rawText.slice(0, 12000)}
"""`;

    let items: SubtaskDraftRow[] = [];
    let usedAi = true;
    let refinedByModel: string | undefined;

    try {
      const { data, successfulModel } = await generateAIJson({
        provider,
        kind: "subtaskBulkPlan",
        model,
        systemInstruction: buildSubtaskBulkSystemInstruction(),
        userPrompt,
      });
      refinedByModel = successfulModel;
      items = normalizePlanItems(data.items || [], defaultAssignee);
    } catch (err) {
      console.error("subtaskBulkPlan AI failed, using heuristic", err);
      usedAi = false;
      items = heuristicSplitSubtasks(rawText).map((row) => ({
        ...row,
        assignee: row.assignee || defaultAssignee,
      }));
    }

    if (items.length === 0) {
      items = heuristicSplitSubtasks(rawText).map((row) => ({
        ...row,
        assignee: row.assignee || defaultAssignee,
      }));
      usedAi = false;
    }

    return NextResponse.json({
      success: true,
      items,
      usedAi,
      refinedByModel,
      parentKey,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed";
    console.error("Subtask plan error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
