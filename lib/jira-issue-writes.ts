import {
  normalizeScoreWrite,
  ownsImpactEffort,
  parseScore,
  toSelectFieldValue,
} from "@/lib/impact-effort";
import { applyLensToLabels, isIssueLens, isStoryLens, type IssueLens } from "@/lib/lens";
import {
  fixVersionValidationError,
  resolveFixVersionForWrite,
} from "@/lib/fix-version-policy";

export type JiraWriteClient = {
  jiraUrl: string;
  headers: Record<string, string>;
};

export async function putIssueFields(
  client: JiraWriteClient,
  issueKey: string,
  fields: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const updateUrl = `${client.jiraUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}`;
  const response = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      ...client.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (response.ok || response.status === 204) {
    return { ok: true };
  }

  const text = await response.text();
  let parsedError = text;
  try {
    const parsed = JSON.parse(text);
    if (parsed.errors) {
      parsedError = Object.entries(parsed.errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
    } else if (parsed.errorMessages) {
      parsedError = parsed.errorMessages.join(", ");
    }
  } catch {
    // raw text
  }

  return {
    ok: false,
    status: response.status,
    error: parsedError || response.statusText,
  };
}

export async function getIssueFields(
  client: JiraWriteClient,
  issueKey: string,
  fieldList: string[]
): Promise<
  | { ok: true; key: string; fields: Record<string, any> }
  | { ok: false; status: number; error: string }
> {
  const qs = encodeURIComponent(fieldList.join(","));
  const url = `${client.jiraUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}?fields=${qs}`;
  const response = await fetch(url, {
    method: "GET",
    headers: client.headers,
  });
  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      error: text || response.statusText,
    };
  }
  const data = await response.json();
  return {
    ok: true,
    key: data.key as string,
    fields: data.fields || {},
  };
}

function resolveEpicKeyFromFields(
  fields: Record<string, any>,
  epicLinkField: string
): string | undefined {
  const epicLink = fields[epicLinkField];
  if (typeof epicLink === "string" && epicLink.trim()) return epicLink.trim();
  if (epicLink && typeof epicLink === "object" && epicLink.key) {
    return String(epicLink.key);
  }
  if (fields.epic?.key) return String(fields.epic.key);
  return undefined;
}

export async function writeIssueLens(
  client: JiraWriteClient,
  issueKey: string,
  lens: IssueLens
): Promise<{ ok: true } | { ok: false; skipped?: boolean; error: string }> {
  if (!isIssueLens(lens)) {
    return { ok: false, error: "Invalid lens." };
  }

  const loaded = await getIssueFields(client, issueKey, [
    "issuetype",
    "labels",
  ]);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const issuetype = (loaded.fields.issuetype?.name || "").toLowerCase();
  if (issuetype === "sub-task" || issuetype === "subtask") {
    return {
      ok: false,
      skipped: true,
      error: "Lens does not apply to sub-tasks.",
    };
  }
  // Epic may use mixed; Story / Bug / Task use story lenses only.
  if (issuetype !== "epic" && !isStoryLens(lens)) {
    return {
      ok: false,
      error: "Mixed lens applies to Epic only.",
    };
  }

  const existingLabels: string[] = Array.isArray(loaded.fields.labels)
    ? loaded.fields.labels
    : [];
  const labels = applyLensToLabels(existingLabels, lens);
  const put = await putIssueFields(client, issueKey, { labels });
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true };
}

export async function writeIssueAssignee(
  client: JiraWriteClient,
  issueKey: string,
  assigneeName: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const fields = {
    assignee: assigneeName ? { name: assigneeName } : null,
  };
  const put = await putIssueFields(client, issueKey, fields);
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true };
}

/** Set or clear system `duedate` (`YYYY-MM-DD` or null). */
export async function writeIssueDueDate(
  client: JiraWriteClient,
  issueKey: string,
  dueDate: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const put = await putIssueFields(client, issueKey, { duedate: dueDate });
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true };
}

/**
 * Set or clear Impact / Effort Select fields (options "1"…"10") on Fix Version owners.
 * Pass `undefined` for a key to leave it unchanged; `null` clears.
 */
export async function writeIssueImpactEffort(
  client: JiraWriteClient,
  issueKey: string,
  opts: {
    impactFieldId: string;
    effortFieldId: string;
    epicLinkField: string;
    impact?: number | null;
    effort?: number | null;
  }
): Promise<
  | { ok: true; impact: number | null; effort: number | null }
  | { ok: false; error: string }
> {
  const impactField = opts.impactFieldId.trim();
  const effortField = opts.effortFieldId.trim();
  if (!impactField || !effortField) {
    return {
      ok: false,
      error: "JIRA_IMPACT_FIELD and JIRA_EFFORT_FIELD must be configured.",
    };
  }

  const hasImpact = opts.impact !== undefined;
  const hasEffort = opts.effort !== undefined;
  if (!hasImpact && !hasEffort) {
    return { ok: false, error: "Provide impact and/or effort." };
  }

  let nextImpact: number | null | undefined = opts.impact;
  let nextEffort: number | null | undefined = opts.effort;

  if (hasImpact) {
    const n = normalizeScoreWrite(opts.impact);
    if (!n.ok) return { ok: false, error: `Impact: ${n.error}` };
    nextImpact = n.value;
  }
  if (hasEffort) {
    const n = normalizeScoreWrite(opts.effort);
    if (!n.ok) return { ok: false, error: `Effort: ${n.error}` };
    nextEffort = n.value;
  }

  const loaded = await getIssueFields(client, issueKey, [
    "issuetype",
    "parent",
    "epic",
    opts.epicLinkField,
    impactField,
    effortField,
  ]);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const issuetype = String(loaded.fields.issuetype?.name || "");
  const epicKey = resolveEpicKeyFromFields(
    loaded.fields,
    opts.epicLinkField
  );
  if (!ownsImpactEffort(issuetype, Boolean(epicKey))) {
    return {
      ok: false,
      error: "Impact/Effort apply only to epics and orphan stories/bugs.",
    };
  }

  // Jira Select custom fields require { value: "N" }, not a bare number.
  const fields: Record<string, unknown> = {};
  if (hasImpact) fields[impactField] = toSelectFieldValue(nextImpact ?? null);
  if (hasEffort) fields[effortField] = toSelectFieldValue(nextEffort ?? null);

  const put = await putIssueFields(client, issueKey, fields);
  if (!put.ok) return { ok: false, error: put.error };

  const currentImpact = hasImpact
    ? (nextImpact as number | null)
    : parseScore(loaded.fields[impactField]);
  const currentEffort = hasEffort
    ? (nextEffort as number | null)
    : parseScore(loaded.fields[effortField]);

  return { ok: true, impact: currentImpact, effort: currentEffort };
}

/** Update summary; for Epic also syncs epic-name custom field. */
export async function writeIssueSummary(
  client: JiraWriteClient,
  issueKey: string,
  summary: string,
  opts?: { issuetype?: string; epicNameField?: string }
): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const trimmed = summary.trim();
  if (!trimmed) {
    return { ok: false, error: "Summary is required." };
  }
  const fields: Record<string, unknown> = { summary: trimmed };
  if (
    (opts?.issuetype || "").toLowerCase() === "epic" &&
    opts?.epicNameField
  ) {
    fields[opts.epicNameField] = trimmed;
  }
  const put = await putIssueFields(client, issueKey, fields);
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true, summary: trimmed };
}

export async function writeIssueFixVersion(
  client: JiraWriteClient,
  issueKey: string,
  fixVersionId: string,
  epicLinkField: string
): Promise<
  | { ok: true }
  | { ok: false; skipped?: boolean; error: string }
> {
  const loaded = await getIssueFields(client, issueKey, [
    "issuetype",
    epicLinkField,
    "fixVersions",
  ]);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const issuetype = loaded.fields.issuetype?.name || "Story";
  const epicKey = resolveEpicKeyFromFields(loaded.fields, epicLinkField);
  const hasEpicLink = Boolean(epicKey);

  const validation = fixVersionValidationError({
    issuetype,
    hasEpicLink,
    selectedRelease: fixVersionId,
  });

  const resolved = resolveFixVersionForWrite({
    issuetype,
    hasEpicLink,
    selectedRelease: fixVersionId,
  });

  if (!resolved.owns) {
    return {
      ok: false,
      skipped: true,
      error: "ورژن از اپیک والد خوانده می‌شود.",
    };
  }

  if (validation) {
    return { ok: false, error: validation };
  }

  const fields: Record<string, unknown> = resolved.value
    ? {
        fixVersions: [
          /^\d+$/.test(resolved.value)
            ? { id: resolved.value }
            : { name: resolved.value },
        ],
      }
    : { fixVersions: [] };

  const put = await putIssueFields(client, issueKey, fields);
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true };
}

/**
 * Set or clear Epic Link on Story/Bug. Linking clears Fix Version (inherited from epic).
 */
export async function writeIssueEpicLink(
  client: JiraWriteClient,
  issueKey: string,
  epicKey: string | null,
  epicLinkField: string
): Promise<
  | { ok: true }
  | { ok: false; skipped?: boolean; error: string }
> {
  const loaded = await getIssueFields(client, issueKey, [
    "issuetype",
    epicLinkField,
    "fixVersions",
  ]);
  if (!loaded.ok) {
    return { ok: false, error: loaded.error };
  }

  const issuetype = (loaded.fields.issuetype?.name || "").toLowerCase();
  if (issuetype !== "story" && issuetype !== "bug") {
    return {
      ok: false,
      skipped: true,
      error: "لینک اپیک فقط برای استوری و باگ است.",
    };
  }

  const nextEpic = (epicKey || "").trim() || null;
  const fields: Record<string, unknown> = {
    [epicLinkField]: nextEpic,
  };
  if (nextEpic) {
    fields.fixVersions = [];
  }

  const put = await putIssueFields(client, issueKey, fields);
  if (!put.ok) return { ok: false, error: put.error };
  return { ok: true };
}

type JiraTransition = {
  id: string;
  name: string;
  to?: { name?: string; statusCategory?: { name?: string; key?: string } };
};

/**
 * Transition an issue to a target status by matching available transitions'
 * destination status name (case-insensitive).
 */
export async function writeIssueStatusTransition(
  client: JiraWriteClient,
  issueKey: string,
  statusName: string
): Promise<
  | { ok: true; transitionName: string }
  | { ok: false; skipped?: boolean; error: string }
> {
  const target = statusName.trim();
  if (!target) {
    return { ok: false, error: "statusName is required." };
  }

  const transitionsUrl = `${client.jiraUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/transitions`;
  const getRes = await fetch(transitionsUrl, {
    method: "GET",
    headers: client.headers,
  });
  if (!getRes.ok) {
    const text = await getRes.text();
    return {
      ok: false,
      error: text || getRes.statusText,
    };
  }

  const data = await getRes.json();
  const transitions: JiraTransition[] = data.transitions || [];
  const targetLower = target.toLowerCase();

  const toMatch = transitions.find(
    (t) => (t.to?.name || "").toLowerCase() === targetLower
  );
  const nameMatch = transitions.find(
    (t) => (t.name || "").toLowerCase() === targetLower
  );
  const selected = toMatch || nameMatch;

  if (!selected) {
    const available = transitions
      .map((t) => t.to?.name || t.name)
      .filter(Boolean)
      .join(", ");
    return {
      ok: false,
      skipped: true,
      error: available
        ? `No transition to "${target}". Available: ${available}`
        : `No transition to "${target}".`,
    };
  }

  const postRes = await fetch(transitionsUrl, {
    method: "POST",
    headers: {
      ...client.headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transition: { id: selected.id },
    }),
  });

  if (!postRes.ok) {
    const text = await postRes.text();
    return {
      ok: false,
      error: text || postRes.statusText,
    };
  }

  return {
    ok: true,
    transitionName: selected.to?.name || selected.name,
  };
}
