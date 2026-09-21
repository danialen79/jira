import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { getIssueFields } from "@/lib/jira-issue-writes";
import { escapeJqlString } from "@/lib/products";

export { escapeJqlString };

export type JiraClient = ReturnType<typeof getJiraClient>;

export type SlimJiraIssue = {
  key: string;
  summary: string;
  status: string;
  issuetype: string;
  priority: string;
  assignee: string | null;
  components: string[];
  labels: string[];
  epicKey: string | null;
  description?: string;
};

export type JiraSearchResult = {
  issues: SlimJiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
  jql: string;
  projectKey: string;
};

const DEFAULT_SEARCH_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "components",
  "labels",
  "parent",
] as const;

function statusName(fields: Record<string, unknown>): string {
  const s = fields.status as { name?: string } | undefined;
  return s?.name || "";
}

function typeName(fields: Record<string, unknown>): string {
  const t = fields.issuetype as { name?: string } | undefined;
  return t?.name || "";
}

function priorityName(fields: Record<string, unknown>): string {
  const p = fields.priority as { name?: string } | undefined;
  return p?.name || "";
}

function assigneeName(fields: Record<string, unknown>): string | null {
  const a = fields.assignee as { displayName?: string } | null | undefined;
  return a?.displayName || null;
}

function componentNames(fields: Record<string, unknown>): string[] {
  const c = fields.components as Array<{ name?: string }> | undefined;
  if (!Array.isArray(c)) return [];
  return c.map((x) => x.name || "").filter(Boolean);
}

function labelNames(fields: Record<string, unknown>): string[] {
  const l = fields.labels;
  if (!Array.isArray(l)) return [];
  return l.map(String).filter(Boolean);
}

function epicFromFields(
  fields: Record<string, unknown>,
  epicLinkField: string
): string | null {
  const epicLink = fields[epicLinkField];
  if (typeof epicLink === "string" && epicLink.trim()) return epicLink.trim();
  if (epicLink && typeof epicLink === "object" && "key" in epicLink) {
    const k = (epicLink as { key?: string }).key;
    if (k) return k;
  }
  const parent = fields.parent as { key?: string; fields?: { issuetype?: { name?: string } } } | undefined;
  if (parent?.key && /epic/i.test(parent.fields?.issuetype?.name || "")) {
    return parent.key;
  }
  return parent?.key || null;
}

function descriptionText(fields: Record<string, unknown>, max = 2000): string {
  const d = fields.description;
  if (typeof d === "string") return d.slice(0, max);
  if (d == null) return "";
  try {
    return JSON.stringify(d).slice(0, max);
  } catch {
    return "";
  }
}

export function slimIssue(
  raw: { key: string; fields?: Record<string, unknown> },
  epicLinkField: string,
  opts?: { includeDescription?: boolean }
): SlimJiraIssue {
  const fields = raw.fields || {};
  const base: SlimJiraIssue = {
    key: raw.key,
    summary: String(fields.summary || ""),
    status: statusName(fields),
    issuetype: typeName(fields),
    priority: priorityName(fields),
    assignee: assigneeName(fields),
    components: componentNames(fields),
    labels: labelNames(fields),
    epicKey: epicFromFields(fields, epicLinkField),
  };
  if (opts?.includeDescription) {
    base.description = descriptionText(fields);
  }
  return base;
}

export async function jiraSearchJql(opts: {
  jql: string;
  fields?: string[];
  startAt?: number;
  maxResults?: number;
  client?: JiraClient;
}): Promise<JiraSearchResult> {
  const client = opts.client ?? getJiraClient();
  const maxResults = Math.min(Math.max(opts.maxResults ?? 15, 1), 50);
  const startAt = Math.max(opts.startAt ?? 0, 0);
  const fields = [
    ...(opts.fields?.length ? opts.fields : [...DEFAULT_SEARCH_FIELDS]),
    client.config.epicLinkField,
  ];

  const response = await fetch(`${client.jiraUrl}/rest/api/2/search`, {
    method: "POST",
    headers: {
      ...client.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jql: opts.jql,
      startAt,
      maxResults,
      fields,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Jira search failed (${response.status}): ${text.slice(0, 300) || response.statusText}`
    );
  }

  const data = (await response.json()) as {
    issues?: Array<{ key: string; fields?: Record<string, unknown> }>;
    total?: number;
  };
  const issues = (data.issues || []).map((raw) =>
    slimIssue(raw, client.config.epicLinkField)
  );

  return {
    issues,
    total: typeof data.total === "number" ? data.total : issues.length,
    startAt,
    maxResults,
    jql: opts.jql,
    projectKey: client.projectKey,
  };
}

export async function getJiraIssue(opts: {
  issueKey: string;
  fields?: string[];
  client?: JiraClient;
}): Promise<SlimJiraIssue> {
  const client = opts.client ?? getJiraClient();
  const fieldList: string[] = opts.fields?.length
    ? opts.fields
    : [
        ...DEFAULT_SEARCH_FIELDS,
        "description",
        "created",
        "updated",
        client.config.epicLinkField,
        client.config.sprintFieldId,
      ].filter((f): f is string => typeof f === "string" && f.length > 0);

  const result = await getIssueFields(
    { jiraUrl: client.jiraUrl, headers: client.headers },
    opts.issueKey.trim(),
    fieldList
  );

  if (!result.ok) {
    throw new Error(
      `Jira get issue failed (${result.status}): ${result.error.slice(0, 300)}`
    );
  }

  return slimIssue(
    { key: result.key, fields: result.fields },
    client.config.epicLinkField,
    { includeDescription: true }
  );
}

export function tryGetJiraClient():
  | { ok: true; client: JiraClient }
  | { ok: false; error: string } {
  try {
    return { ok: true, client: getJiraClient() };
  } catch (e) {
    const msg =
      e instanceof JiraEnvError
        ? e.message
        : e instanceof Error
          ? e.message
          : "Jira not configured";
    return { ok: false, error: msg };
  }
}
