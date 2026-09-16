import { getJiraSupportProjectKey } from "@/lib/jira";

export type SupportLinkedSip = {
  key: string;
  summary: string;
  type: string;
};

export type SupportInboxItem = {
  key: string;
  summary: string;
  description: string;
  status: string;
  issuetype: string;
  priority: string;
  updated: string;
  created: string;
  linkedSipKeys: string[];
};

export type SupportAttachment = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  content: string;
};

export type SupportComment = {
  id: string;
  author: string;
  created: string;
  body: string;
};

export type SupportIssueDetail = SupportInboxItem & {
  reporter?: string;
  assignee?: string;
  assigneeDisplayName?: string;
  linkedSip: SupportLinkedSip[];
  attachments: SupportAttachment[];
  comments: SupportComment[];
};

export function jiraCommentBodyToText(body: unknown): string {
  if (typeof body === "string") return body;
  if (body && typeof body === "object") {
    return JSON.stringify(body);
  }
  return "";
}

export function mapSupportAttachments(
  raw: unknown[] | null | undefined
): SupportAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a) => {
      const item = a as {
        id?: string | number;
        filename?: string;
        size?: number;
        mimeType?: string;
        content?: string;
      };
      const id = item.id != null ? String(item.id) : "";
      if (!id || !item.filename) return null;
      return {
        id,
        filename: item.filename,
        size: typeof item.size === "number" ? item.size : 0,
        mimeType: item.mimeType || "",
        content: item.content || "",
      };
    })
    .filter((x): x is SupportAttachment => x !== null);
}

export function mapSupportComments(
  raw: unknown[] | null | undefined
): SupportComment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const item = c as {
        id?: string | number;
        author?: { displayName?: string; name?: string };
        created?: string;
        body?: unknown;
      };
      const id = item.id != null ? String(item.id) : "";
      if (!id) return null;
      return {
        id,
        author: item.author?.displayName || item.author?.name || "",
        created: item.created || "",
        body: jiraCommentBodyToText(item.body),
      };
    })
    .filter((x): x is SupportComment => x !== null);
}

export function supportQueuedComment(sipKey: string): string {
  const key = sipKey.trim().toUpperCase();
  return `در صف بررسی و انجام قرار گرفت. (${key})`;
}

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function supportInboxJql(supportProjectKey: string): string {
  const pk = escapeJqlString(supportProjectKey);
  return `project = '${pk}' AND assignee = currentUser() AND resolution = EMPTY ORDER BY updated DESC`;
}

export function isSupportIssueKey(key: string, supportProjectKey?: string): boolean {
  const pk = (supportProjectKey || getJiraSupportProjectKey()).toUpperCase();
  const prefix = `${pk}-`;
  return key.trim().toUpperCase().startsWith(prefix);
}

export function extractLinkedIssues(
  issuelinks: unknown[] | null | undefined,
  deliveryPrefix?: string
): SupportLinkedSip[] {
  const links = Array.isArray(issuelinks) ? issuelinks : [];
  const out: SupportLinkedSip[] = [];
  const seen = new Set<string>();

  for (const raw of links) {
    const link = raw as {
      type?: { name?: string };
      outwardIssue?: { key?: string; fields?: { summary?: string } };
      inwardIssue?: { key?: string; fields?: { summary?: string } };
    };
    for (const side of [link.outwardIssue, link.inwardIssue]) {
      const key = (side?.key || "").trim().toUpperCase();
      if (!key || seen.has(key)) continue;
      if (deliveryPrefix && !key.startsWith(`${deliveryPrefix.toUpperCase()}-`)) {
        continue;
      }
      seen.add(key);
      out.push({
        key,
        summary: side?.fields?.summary || "",
        type: link.type?.name || "Relates",
      });
    }
  }
  return out;
}

export function mapSupportIssue(
  issue: {
    key: string;
    fields?: Record<string, any>;
  },
  deliveryProjectKey: string,
  extras?: {
    attachments?: SupportAttachment[];
    comments?: SupportComment[];
  }
): SupportIssueDetail {
  const f = issue.fields || {};
  const linkedSip = extractLinkedIssues(f.issuelinks, deliveryProjectKey);
  return {
    key: issue.key,
    summary: f.summary || "",
    description: typeof f.description === "string" ? f.description : "",
    status: f.status?.name || "",
    issuetype: f.issuetype?.name || "",
    priority: f.priority?.name || "Medium",
    updated: f.updated || "",
    created: f.created || "",
    linkedSipKeys: linkedSip.map((l) => l.key),
    reporter: f.reporter?.displayName || f.reporter?.name || "",
    assignee: f.assignee?.name || "",
    assigneeDisplayName: f.assignee?.displayName || "",
    linkedSip,
    attachments:
      extras?.attachments ??
      mapSupportAttachments(f.attachment as unknown[] | undefined),
    comments: extras?.comments ?? [],
  };
}

export async function createJiraIssueLink(opts: {
  jiraUrl: string;
  headers: Record<string, string>;
  inwardKey: string;
  outwardKey: string;
  typeName?: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const response = await fetch(`${opts.jiraUrl}/rest/api/2/issueLink`, {
    method: "POST",
    headers: {
      ...opts.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: { name: opts.typeName || "Relates" },
      inwardIssue: { key: opts.inwardKey.trim().toUpperCase() },
      outwardIssue: { key: opts.outwardKey.trim().toUpperCase() },
    }),
  });

  if (response.ok || response.status === 201 || response.status === 204) {
    return { ok: true };
  }
  const text = await response.text();
  return {
    ok: false,
    status: response.status,
    error: text || response.statusText,
  };
}

export async function addJiraComment(opts: {
  jiraUrl: string;
  headers: Record<string, string>;
  issueKey: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const response = await fetch(
    `${opts.jiraUrl}/rest/api/2/issue/${encodeURIComponent(opts.issueKey.trim())}/comment`,
    {
      method: "POST",
      headers: {
        ...opts.headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: opts.body }),
    }
  );

  if (response.ok || response.status === 201) {
    return { ok: true };
  }
  const text = await response.text();
  return {
    ok: false,
    status: response.status,
    error: text || response.statusText,
  };
}

export function alreadyLinked(
  linkedSipKeys: string[],
  sipKey: string
): boolean {
  const target = sipKey.trim().toUpperCase();
  return linkedSipKeys.some((k) => k.toUpperCase() === target);
}
