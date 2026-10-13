import { NextResponse } from "next/server";
import { generateAIJson } from "@/lib/ai-provider";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { isEpicIssueType } from "@/lib/fix-version-policy";
import {
  buildStoryBulkSystemInstruction,
  heuristicSplitStories,
  normalizeStoryPlanItems,
  type StoryDraftRow,
} from "@/lib/story-bulk";

async function fetchExistingChildren(
  jiraUrl: string,
  headers: Record<string, string>,
  epicLinkField: string,
  epicKey: string
): Promise<{ key: string; summary: string }[]> {
  const jql = `"Epic Link" = ${epicKey} OR parent = ${epicKey} ORDER BY key ASC`;
  const response = await fetch(`${jiraUrl}/rest/api/2/search`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      jql,
      startAt: 0,
      maxResults: 100,
      fields: ["summary", epicLinkField],
    }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.issues || []).map((raw: any) => ({
    key: raw.key as string,
    summary: raw.fields?.summary || "",
  }));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const epicKey = String(body.epicKey || "")
      .trim()
      .toUpperCase();
    const rawText = String(body.rawText || "").trim();
    const defaultAssignee = String(body.defaultAssignee || "").trim();
    const defaultLens = String(body.defaultLens || "").trim();
    const provider = body.provider;
    const model = body.model;

    if (!epicKey) {
      return NextResponse.json(
        { error: "epicKey is required." },
        { status: 400 }
      );
    }
    if (!rawText) {
      return NextResponse.json(
        { error: "rawText is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";

    const epicRes = await fetch(
      `${jiraUrl}/rest/api/2/issue/${encodeURIComponent(epicKey)}?fields=summary,issuetype,components`,
      { headers }
    );
    if (!epicRes.ok) {
      const text = await epicRes.text();
      return NextResponse.json(
        { error: `Epic not found (${epicRes.status}): ${text}` },
        { status: epicRes.status === 404 ? 404 : 502 }
      );
    }
    const epicData = await epicRes.json();
    const epicSummary = epicData.fields?.summary || "";
    const epicType = epicData.fields?.issuetype?.name || "Epic";

    if (!isEpicIssueType(epicType)) {
      return NextResponse.json(
        { error: "Parent must be an Epic." },
        { status: 400 }
      );
    }

    const components = Array.isArray(epicData.fields?.components)
      ? epicData.fields.components
          .map((c: { name?: string }) => c.name || "")
          .filter(Boolean)
      : [];

    const existing = await fetchExistingChildren(
      jiraUrl,
      headers,
      epicLinkField,
      epicKey
    );
    const existingLines = existing
      .map((s) => `- ${s.key}: ${s.summary}`)
      .join("\n");

    const usersList = Array.isArray(body.teamUsers)
      ? (body.teamUsers as { name?: string; displayName?: string }[])
          .map((u) => `${u.name || ""} (${u.displayName || ""})`.trim())
          .filter(Boolean)
          .join(", ")
      : "";

    const userPrompt = `Epic (fixed — all Stories link here via Epic Link):
Key: ${epicKey}
Summary: ${epicSummary}
Components: ${components.join(", ") || "(none)"}

Existing children (avoid duplicates; set duplicateOfExistingKey when same):
${existingLines || "(none)"}

Team usernames for assignee hints (optional):
${usersList || "(not provided)"}

Default assignee if none inferred: ${defaultAssignee || "(empty)"}
Default lens if none inferred: ${defaultLens || "(empty)"}

User dump:
"""
${rawText.slice(0, 12000)}
"""`;

    let items: StoryDraftRow[] = [];
    let usedAi = true;
    let refinedByModel: string | undefined;
    const defaults = { assignee: defaultAssignee, lens: defaultLens };

    try {
      const { data, successfulModel } = await generateAIJson({
        provider,
        kind: "storyBulkPlan",
        model,
        systemInstruction: buildStoryBulkSystemInstruction(),
        userPrompt,
      });
      refinedByModel = successfulModel;
      items = normalizeStoryPlanItems(data.items || [], defaults);
    } catch (err) {
      console.error("storyBulkPlan AI failed, using heuristic", err);
      usedAi = false;
      items = heuristicSplitStories(rawText, defaults);
    }

    if (items.length === 0) {
      items = heuristicSplitStories(rawText, defaults);
      usedAi = false;
    }

    return NextResponse.json({
      success: true,
      items,
      usedAi,
      refinedByModel,
      epicKey,
      component: components[0] || "",
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed";
    console.error("Story plan error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
