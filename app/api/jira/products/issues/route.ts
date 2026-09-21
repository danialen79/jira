import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import {
  mapRawToProductIssue,
  PRODUCT_ORPHAN_KEY,
  unfinishedProductJql,
  type ProductIssue,
} from "@/lib/products";

const PAGE = 100;
const MAX_PAGES = 20;

async function jiraSearchPage(opts: {
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
    total: typeof data.total === "number" ? data.total : (data.issues || []).length,
  };
}

async function fetchEpicSummaries(opts: {
  jiraUrl: string;
  headers: HeadersInit;
  keys: string[];
}): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(opts.keys.filter(Boolean))];
  if (unique.length === 0) return map;

  const chunkSize = 40;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const keys = chunk.map((k) => `"${k}"`).join(", ");
    try {
      const { issues } = await jiraSearchPage({
        jiraUrl: opts.jiraUrl,
        headers: opts.headers,
        jql: `key in (${keys})`,
        fields: ["summary"],
        startAt: 0,
        maxResults: chunk.length,
      });
      for (const raw of issues) {
        map.set(raw.key, raw.fields?.summary || raw.key);
      }
    } catch (e) {
      console.warn("[Products] epic summary fetch failed", e);
    }
  }
  return map;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const component = searchParams.get("component")?.trim() || "";
    const orphan =
      searchParams.get("orphan") === "1" ||
      component === PRODUCT_ORPHAN_KEY;

    if (!orphan && !component) {
      return NextResponse.json(
        { error: "component or orphan=1 is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";

    const jql = unfinishedProductJql(projectKey, {
      component: orphan ? undefined : component,
      orphan,
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

    const issues: ProductIssue[] = [];
    let startAt = 0;
    let total = Infinity;
    let pages = 0;
    const rawBatch: any[] = [];

    while (startAt < total && pages < MAX_PAGES) {
      const page = await jiraSearchPage({
        jiraUrl,
        headers,
        jql,
        fields,
        startAt,
        maxResults: PAGE,
      });
      total = page.total;
      pages += 1;
      rawBatch.push(...page.issues);
      startAt += PAGE;
      if (page.issues.length === 0) break;
    }

    const epicKeysNeeded: string[] = [];
    for (const raw of rawBatch) {
      const fieldsObj = raw.fields || {};
      const typeName = (fieldsObj.issuetype?.name || "").toLowerCase();
      if (typeName === "epic") continue;
      // resolve without map first
      const link = fieldsObj[epicLinkField];
      const key =
        (typeof link === "string" && link) ||
        (link && typeof link === "object" && link.key) ||
        fieldsObj.epic?.key ||
        (fieldsObj.parent?.fields?.issuetype?.name?.toLowerCase() === "epic"
          ? fieldsObj.parent?.key
          : undefined);
      if (key) epicKeysNeeded.push(String(key));
    }

    const epicSummaries = await fetchEpicSummaries({
      jiraUrl,
      headers,
      keys: epicKeysNeeded,
    });

    for (const raw of rawBatch) {
      const mapped = mapRawToProductIssue(raw, epicLinkField, epicSummaries);
      if (mapped) issues.push(mapped);
    }

    return NextResponse.json({
      success: true,
      projectKey,
      component: orphan ? PRODUCT_ORPHAN_KEY : component,
      orphan,
      total: issues.length,
      jiraTotal: total === Infinity ? issues.length : total,
      jql,
      issues,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Product Issues Error:", err);
    return NextResponse.json(
      { error: `Failed to load product issues: ${message}` },
      { status: 500 }
    );
  }
}
