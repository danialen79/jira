import { NextResponse } from "next/server";
import {
  incompletenessFromFilters,
  isBacklogExcludedStatus,
  matchesIncompleteness,
} from "@/lib/issue-ops/backlog";
import { buildOpsSearchJql, parseOpsFilters } from "@/lib/issue-ops/filters";
import { mapRawToOpsIssue } from "@/lib/issue-ops/map";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

const PAGE_SIZE_DEFAULT = 50;
const PAGE_SIZE_MAX = 100;

async function jiraSearch(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  jql: string;
  fields: string[];
  startAt: number;
  maxResults: number;
}): Promise<{ issues: any[]; total: number }> {
  const response = await fetch(`${opts.jiraUrl}/rest/api/2/search`, {
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: opts.jql,
      startAt: opts.startAt,
      maxResults: opts.maxResults,
      fields: opts.fields,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Jira search failed (${response.status}): ${text || response.statusText}`
    );
  }

  const data = await response.json();
  return {
    issues: data.issues || [],
    total:
      typeof data.total === "number"
        ? data.total
        : (data.issues || []).length,
  };
}

async function fetchEpicFixVersions(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  epicKeys: string[];
}): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>();
  const unique = [...new Set(opts.epicKeys.filter(Boolean))];
  if (unique.length === 0) return map;

  const chunkSize = 40;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const keys = chunk.map((k) => `"${k}"`).join(", ");
    const jql = `key in (${keys})`;
    try {
      const { issues } = await jiraSearch({
        jiraUrl: opts.jiraUrl,
        headers: opts.headers,
        jql,
        fields: ["fixVersions"],
        startAt: 0,
        maxResults: chunk.length,
      });
      for (const raw of issues) {
        const fvs = Array.isArray(raw.fields?.fixVersions)
          ? raw.fields.fixVersions
          : [];
        if (fvs[0]?.id != null) {
          map.set(raw.key, {
            id: String(fvs[0].id),
            name: String(fvs[0].name || ""),
          });
        }
      }
    } catch (e) {
      console.warn("Failed to fetch epic fix versions for", chunk, e);
    }
  }
  return map;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filters = parseOpsFilters(url.searchParams);
    const startAt = Math.max(
      0,
      Number.parseInt(url.searchParams.get("startAt") || "0", 10) || 0
    );
    const rawMax = Number.parseInt(
      url.searchParams.get("maxResults") || String(PAGE_SIZE_DEFAULT),
      10
    );
    const maxResults = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, rawMax || PAGE_SIZE_DEFAULT)
    );

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";

    const jql = buildOpsSearchJql(projectKey, filters, {
      epicLinkField,
    });

    const fields = [
      "summary",
      "status",
      "issuetype",
      "priority",
      "assignee",
      "components",
      "labels",
      "fixVersions",
      "parent",
      epicLinkField,
    ];

    const { issues: rawIssues, total } = await jiraSearch({
      jiraUrl,
      headers,
      jql,
      fields,
      startAt,
      maxResults,
    });

    const incompleteness = incompletenessFromFilters(filters);

    let issues = rawIssues
      .map((raw) => mapRawToOpsIssue(raw, epicLinkField))
      .filter((i) => !i.isSubtask)
      .filter((i) => !isBacklogExcludedStatus(i.status, i.statusCategoryKey))
      .filter((i) => matchesIncompleteness(i, incompleteness));

    const childEpicKeys = issues
      .filter((i) => !i.ownsFixVersion && i.epicKey)
      .map((i) => i.epicKey!) as string[];

    if (childEpicKeys.length > 0) {
      const epicMap = await fetchEpicFixVersions({
        jiraUrl,
        headers,
        epicKeys: childEpicKeys,
      });
      issues = issues.map((issue) => {
        if (issue.ownsFixVersion || !issue.epicKey) return issue;
        const inherited = epicMap.get(issue.epicKey);
        if (!inherited) return issue;
        return {
          ...issue,
          effectiveFixVersionId: inherited.id,
          effectiveFixVersionName: inherited.name,
          effectiveFixVersionFromEpic: true,
        };
      });
    }

    return NextResponse.json({
      success: true,
      issues,
      total,
      startAt,
      maxResults,
      jql,
      projectKey,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Ops Search Error:", err);
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
