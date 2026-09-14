import { NextResponse } from "next/server";
import { isBacklogExcludedStatus } from "@/lib/issue-ops/backlog";
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

async function resolveVersionName(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  projectKey: string;
  versionValue: string;
}): Promise<string | null> {
  const { versionValue } = opts;
  if (!versionValue || versionValue === "ALL" || versionValue === "NONE") {
    return null;
  }
  if (!/^\d+$/.test(versionValue)) return versionValue;
  try {
    const response = await fetch(
      `${opts.jiraUrl}/rest/api/2/project/${opts.projectKey}/versions`,
      { method: "GET", headers: opts.headers }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const hit = (data || []).find(
      (v: { id?: string | number }) => String(v.id) === versionValue
    );
    return hit?.name ? String(hit.name) : null;
  } catch {
    return null;
  }
}

async function fetchEpicKeysWithFixVersion(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  projectKey: string;
  versionValue: string;
  versionName?: string | null;
}): Promise<string[]> {
  const { versionValue, versionName } = opts;
  if (!versionValue || versionValue === "ALL" || versionValue === "NONE") {
    return [];
  }
  const isId = /^\d+$/.test(versionValue);
  const fvParts: string[] = [];
  if (isId) fvParts.push(`fixVersion = ${versionValue}`);
  if (versionName) {
    fvParts.push(
      `fixVersion = "${versionName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    );
  } else if (!isId) {
    fvParts.push(
      `fixVersion = "${versionValue.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    );
  }
  const fv =
    fvParts.length <= 1 ? fvParts[0] : `(${fvParts.join(" OR ")})`;
  if (!fv) return [];
  const jql = `project = '${opts.projectKey}' AND issuetype = Epic AND ${fv}`;
  try {
    const { issues } = await jiraSearch({
      jiraUrl: opts.jiraUrl,
      headers: opts.headers,
      jql,
      fields: ["summary"],
      startAt: 0,
      maxResults: 200,
    });
    return issues.map((i: { key: string }) => i.key as string);
  } catch (e) {
    console.warn("Failed to fetch epics for version filter", versionValue, e);
    return [];
  }
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

    const versionName = await resolveVersionName({
      jiraUrl,
      headers,
      projectKey,
      versionValue: filters.version,
    });

    const epicKeysWithVersion = await fetchEpicKeysWithFixVersion({
      jiraUrl,
      headers,
      projectKey,
      versionValue: filters.version,
      versionName,
    });

    const jql = buildOpsSearchJql(projectKey, filters, {
      epicLinkField,
      epicKeysWithVersion,
      versionName,
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

    let issues = rawIssues
      .map((raw) => mapRawToOpsIssue(raw, epicLinkField))
      .filter((i) => !i.isSubtask);

    // Belt-and-suspenders: never show Done/Canceled in backlog scope
    if (filters.backlog === "1") {
      issues = issues.filter(
        (i) => !isBacklogExcludedStatus(i.status, i.statusCategoryKey)
      );
    }

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
