import { NextResponse } from "next/server";
import {
  epicLinkJqlToken,
  isBacklogExcludedStatus,
} from "@/lib/issue-ops/backlog";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import {
  EPIC_LENS_OPTIONS,
  parseLensFromLabels,
  type IssueLens,
} from "@/lib/lens";

type AuditMode = "component" | "lens";

const ORPHAN_GROUP_KEY = "__orphans__";

function isSubtaskType(name: string): boolean {
  const n = (name || "").trim().toLowerCase();
  return n === "sub-task" || n === "subtask" || n.includes("subtask");
}

function isEligibleChildType(name: string): boolean {
  const n = (name || "").trim().toLowerCase();
  if (!n || n === "epic") return false;
  return !isSubtaskType(n);
}

function lensMissingJql(): string {
  const labels = EPIC_LENS_OPTIONS.map((o) => `"${o.jiraLabel}"`).join(", ");
  return `(labels is EMPTY OR labels not in (${labels}))`;
}

function childMatchesMode(
  mode: AuditMode,
  components: string[],
  lens: IssueLens | undefined
): boolean {
  if (mode === "component") return components.length === 0;
  return !lens;
}

async function jiraSearch(
  jiraUrl: string,
  headers: Record<string, string>,
  jqlCandidates: string[],
  fields: string[],
  maxResults: number
): Promise<any[]> {
  for (const jql of jqlCandidates) {
    try {
      const res = await fetch(`${jiraUrl}/rest/api/2/search`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jql,
          startAt: 0,
          maxResults,
          fields,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.issues || [];
      }
      console.warn(
        `[Epic Sync Audit] JQL failed (${res.status}): ${await res.text()}`
      );
    } catch (e) {
      console.warn(`[Epic Sync Audit] JQL error for: ${jql}`, e);
    }
  }
  return [];
}

function resolveParentKey(
  fields: any,
  epicMap: Record<string, any>,
  epicKeys: string[],
  epicLinkField: string
): string | null {
  if (fields.epic?.key && epicMap[fields.epic.key]) return fields.epic.key;
  if (fields.parent?.key && epicMap[fields.parent.key]) return fields.parent.key;
  if (fields[epicLinkField] && epicMap[fields[epicLinkField]]) {
    return fields[epicLinkField];
  }
  if (fields.customfield_10014 && epicMap[fields.customfield_10014]) {
    return fields.customfield_10014;
  }
  for (const ek of epicKeys) {
    if (JSON.stringify(fields).includes(ek)) return ek;
  }
  return null;
}

function mapChildIssue(issue: any, epicComps: string[] = []) {
  const fields = issue.fields || {};
  const childComps = (fields.components || [])
    .map((c: any) => c.name)
    .filter(Boolean);
  const labels: string[] = Array.isArray(fields.labels) ? fields.labels : [];
  const lens = parseLensFromLabels(labels);
  const missingComponents = epicComps.filter(
    (ec: string) =>
      !childComps.some(
        (cc: string) => cc.toLowerCase().trim() === ec.toLowerCase().trim()
      )
  );

  return {
    key: issue.key,
    summary: fields.summary || "",
    issuetype: fields.issuetype?.name || "Story",
    status: fields.status?.name || "Todo",
    statusCategoryKey: fields.status?.statusCategory?.key as string | undefined,
    components: childComps,
    missingComponents,
    lens: lens ?? null,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      startAt = 0,
      maxResults = 10,
      mode: rawMode = "component",
    } = body || {};

    const mode: AuditMode = rawMode === "lens" ? "lens" : "component";

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";
    const epicLinkJql = epicLinkJqlToken(epicLinkField);
    const projKey = projectKey;

    let cfNumber = "";
    if (epicLinkField.startsWith("customfield_")) {
      cfNumber = epicLinkField.replace("customfield_", "");
    }

    const epicIssues = await jiraSearch(
      jiraUrl,
      headers,
      [
        `project = '${projKey}' AND issuetype = 'Epic' AND statusCategory != Done ORDER BY key DESC`,
        `project = '${projKey}' AND issuetype = 'Epic' ORDER BY key DESC`,
      ],
      [
        "summary",
        "components",
        "status",
        "priority",
        "issuetype",
        "labels",
      ],
      300
    );

    const epicMap: Record<string, any> = {};
    const epicKeys: string[] = [];

    for (const issue of epicIssues) {
      const statusName = issue.fields?.status?.name || "";
      const statusCategoryKey = issue.fields?.status?.statusCategory?.key;
      if (isBacklogExcludedStatus(statusName, statusCategoryKey)) continue;

      const key = issue.key;
      epicKeys.push(key);
      const comps = (issue.fields?.components || [])
        .map((c: any) => c.name)
        .filter(Boolean);
      const labels: string[] = Array.isArray(issue.fields?.labels)
        ? issue.fields.labels
        : [];

      epicMap[key] = {
        key,
        summary: issue.fields?.summary || key,
        components: comps,
        lens: parseLensFromLabels(labels) ?? null,
        status: statusName,
        kind: "epic" as const,
        childIssues: [],
      };
    }

    if (epicKeys.length > 0) {
      const chunkSize = 50;
      const childFields = [
        "summary",
        "components",
        "status",
        "priority",
        "issuetype",
        "labels",
        epicLinkField,
        "customfield_10014",
        "parent",
        "epic",
      ];

      for (let i = 0; i < epicKeys.length; i += chunkSize) {
        const chunkKeys = epicKeys.slice(i, i + chunkSize);
        const formatted = chunkKeys.map((k) => `"${k}"`).join(",");

        const jqlCandidates = [
          cfNumber
            ? `project = '${projKey}' AND statusCategory != Done AND issuetype in (Story, Bug, Task) AND (cf[${cfNumber}] in (${formatted}) OR "Epic Link" in (${formatted}) OR parent in (${formatted}))`
            : null,
          `project = '${projKey}' AND statusCategory != Done AND issuetype in (Story, Bug, Task) AND ("${epicLinkField}" in (${formatted}) OR "Epic Link" in (${formatted}) OR parent in (${formatted}))`,
          `project = '${projKey}' AND statusCategory != Done AND issuetype in (Story, Bug, Task) AND ("Epic Link" in (${formatted}) OR parent in (${formatted}))`,
          `project = '${projKey}' AND issuetype in (Story, Bug, Task) AND ("Epic Link" in (${formatted}) OR parent in (${formatted}))`,
        ].filter(Boolean) as string[];

        const children = await jiraSearch(
          jiraUrl,
          headers,
          jqlCandidates,
          childFields,
          500
        );

        for (const issue of children) {
          const fields = issue.fields || {};
          const typeName = fields.issuetype?.name || "";
          if (!isEligibleChildType(typeName)) continue;

          const statusName = fields.status?.name || "";
          const statusCategoryKey = fields.status?.statusCategory?.key;
          if (isBacklogExcludedStatus(statusName, statusCategoryKey)) continue;

          const parentKey = resolveParentKey(
            fields,
            epicMap,
            epicKeys,
            epicLinkField
          );
          if (!parentKey || !epicMap[parentKey]) continue;

          const mapped = mapChildIssue(issue, epicMap[parentKey].components);
          if (!childMatchesMode(mode, mapped.components, mapped.lens ?? undefined)) {
            continue;
          }
          epicMap[parentKey].childIssues.push(mapped);
        }
      }
    }

    const qualifiedEpics = Object.values(epicMap).filter(
      (epic: any) => epic.childIssues.length > 0
    );

    const orphanFilter =
      mode === "component"
        ? "component is EMPTY"
        : lensMissingJql();

    const orphanJqlCandidates = [
      `project = '${projKey}' AND issuetype in (Story, Bug, Task) AND ${epicLinkJql} is EMPTY AND ${orphanFilter} AND statusCategory != Done ORDER BY key DESC`,
      `project = '${projKey}' AND issuetype in (Story, Bug, Task) AND "Epic Link" is EMPTY AND ${orphanFilter} AND statusCategory != Done ORDER BY key DESC`,
      `project = '${projKey}' AND issuetype in (Story, Bug, Task) AND ${epicLinkJql} is EMPTY AND ${orphanFilter} ORDER BY key DESC`,
    ];

    const orphanIssues = await jiraSearch(
      jiraUrl,
      headers,
      orphanJqlCandidates,
      [
        "summary",
        "components",
        "status",
        "priority",
        "issuetype",
        "labels",
        epicLinkField,
        "parent",
      ],
      200
    );

    const orphanChildren = [];
    for (const issue of orphanIssues) {
      const fields = issue.fields || {};
      const typeName = fields.issuetype?.name || "";
      if (!isEligibleChildType(typeName)) continue;

      const statusName = fields.status?.name || "";
      const statusCategoryKey = fields.status?.statusCategory?.key;
      if (isBacklogExcludedStatus(statusName, statusCategoryKey)) continue;

      // Skip if somehow linked to a known epic / has parent story
      if (fields.parent?.key) continue;
      const linkVal = fields[epicLinkField] || fields.customfield_10014;
      if (linkVal) continue;

      const mapped = mapChildIssue(issue);
      if (!childMatchesMode(mode, mapped.components, mapped.lens ?? undefined)) {
        continue;
      }
      orphanChildren.push(mapped);
    }

    const groups: any[] = [...qualifiedEpics];
    if (orphanChildren.length > 0) {
      groups.push({
        key: ORPHAN_GROUP_KEY,
        summary: "",
        components: [],
        lens: null,
        status: "",
        kind: "orphan",
        childIssues: orphanChildren,
      });
    }

    const startAtNum = Number(startAt) || 0;
    const maxResultsNum = Number(maxResults) || 10;
    const totalQualified = groups.length;
    const paged = groups.slice(startAtNum, startAtNum + maxResultsNum);

    return NextResponse.json({
      success: true,
      mode,
      total: totalQualified,
      startAt: startAtNum,
      maxResults: maxResultsNum,
      epics: paged,
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Epic Sync Audit Error:", err);
    return NextResponse.json(
      { error: `Audit failed: ${err.message}` },
      { status: 500 }
    );
  }
}
