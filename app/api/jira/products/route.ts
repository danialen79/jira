import { NextResponse } from "next/server";
import { isBacklogExcludedStatus } from "@/lib/issue-ops/backlog";
import { isSubtaskIssueType } from "@/lib/issue-ops/map";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import {
  bumpProductBucket,
  emptyProductBucket,
  PRODUCT_ORPHAN_KEY,
  unfinishedProductJql,
  type ProductWorkSummary,
} from "@/lib/products";

const PAGE = 100;
const MAX_PAGES = 30;

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

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const compsRes = await fetch(
      `${jiraUrl}/rest/api/2/project/${encodeURIComponent(projectKey)}/components`,
      { method: "GET", headers }
    );
    if (!compsRes.ok) {
      const text = await compsRes.text();
      return NextResponse.json(
        {
          error: `Failed to fetch components (${compsRes.status}): ${text || compsRes.statusText}`,
        },
        { status: compsRes.status }
      );
    }

    const rawComps = (await compsRes.json()) as Array<{
      id: string;
      name: string;
    }>;

    const byKey = new Map<string, ProductWorkSummary>();
    for (const c of rawComps) {
      byKey.set(c.name, emptyProductBucket(c.name, c.name, String(c.id)));
    }
    byKey.set(
      PRODUCT_ORPHAN_KEY,
      emptyProductBucket(PRODUCT_ORPHAN_KEY, "بدون پروداکت")
    );

    const jql = unfinishedProductJql(projectKey);
    const fields = ["summary", "status", "issuetype", "components", "fixVersions"];

    let startAt = 0;
    let total = Infinity;
    let pages = 0;

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

      for (const raw of page.issues) {
        const fieldsObj = raw.fields || {};
        if (isSubtaskIssueType(fieldsObj)) continue;

        const statusName = fieldsObj.status?.name || "";
        const statusCategoryKey = fieldsObj.status?.statusCategory?.key as
          | string
          | undefined;
        if (isBacklogExcludedStatus(statusName, statusCategoryKey)) continue;

        const hasFix =
          Array.isArray(fieldsObj.fixVersions) &&
          fieldsObj.fixVersions.length > 0;
        const comps = ((fieldsObj.components as { name: string }[]) || [])
          .map((c) => c.name)
          .filter(Boolean);

        if (comps.length === 0) {
          const orphan = byKey.get(PRODUCT_ORPHAN_KEY)!;
          bumpProductBucket(orphan, statusName, statusCategoryKey, hasFix);
          continue;
        }

        for (const name of comps) {
          let bucket = byKey.get(name);
          if (!bucket) {
            bucket = emptyProductBucket(name, name);
            byKey.set(name, bucket);
          }
          bumpProductBucket(bucket, statusName, statusCategoryKey, hasFix);
        }
      }

      startAt += PAGE;
      if (page.issues.length === 0) break;
    }

    const products = [...byKey.values()].sort((a, b) => {
      if (a.key === PRODUCT_ORPHAN_KEY) return 1;
      if (b.key === PRODUCT_ORPHAN_KEY) return -1;
      if (b.unfinished !== a.unfinished) return b.unfinished - a.unfinished;
      return a.name.localeCompare(b.name, "en");
    });

    const totals = products.reduce(
      (acc, p) => {
        if (p.key === PRODUCT_ORPHAN_KEY) {
          acc.orphan = p.unfinished;
          return acc;
        }
        acc.unfinished += p.unfinished;
        acc.todo += p.todo;
        acc.inProgress += p.inProgress;
        acc.unplanned += p.unplanned;
        return acc;
      },
      { unfinished: 0, todo: 0, inProgress: 0, unplanned: 0, orphan: 0 }
    );

    return NextResponse.json({
      success: true,
      projectKey,
      products,
      totals,
      scanned: Math.min(total === Infinity ? 0 : total, PAGE * MAX_PAGES),
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Products Summary Error:", err);
    return NextResponse.json(
      { error: `Failed to load products: ${message}` },
      { status: 500 }
    );
  }
}
