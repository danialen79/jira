import { backlogJqlFragment, epicLinkJqlToken } from "@/lib/issue-ops/backlog";
import type { OpsFilterValues } from "@/lib/issue-ops/types";

export type FilterDef = {
  id: keyof OpsFilterValues;
  urlKey: string;
  defaultValue: string;
  toJql: (value: string, ctx?: { epicLinkJql?: string }) => string | null;
};

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/i;

function escapeJqlString(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export const OPS_FILTER_DEFS: FilterDef[] = [
  {
    id: "backlog",
    urlKey: "backlog",
    defaultValue: "1",
    toJql: (value, ctx) =>
      value === "1"
        ? backlogJqlFragment(ctx?.epicLinkJql || '"Epic Link"')
        : null,
  },
  {
    id: "type",
    urlKey: "type",
    defaultValue: "ALL",
    toJql: (value) => {
      if (!value || value === "ALL") return null;
      return `issuetype = "${escapeJqlString(value)}"`;
    },
  },
  {
    id: "status",
    urlKey: "status",
    defaultValue: "ALL",
    toJql: (value) => {
      if (!value || value === "ALL") return null;
      return `status = "${escapeJqlString(value)}"`;
    },
  },
  {
    id: "version",
    urlKey: "version",
    defaultValue: "ALL",
    /**
     * NONE → owners without Fix Version.
     * Numeric id → handled in buildOpsSearchJql (may expand via epic children).
     * Name fallback → fixVersion = "name"
     */
    toJql: (value, ctx) => {
      if (!value || value === "ALL") return null;
      if (value === "NONE") {
        const epic = ctx?.epicLinkJql || '"Epic Link"';
        return `(fixVersion is EMPTY AND (${epic} is EMPTY OR issuetype = Epic))`;
      }
      // Specific version: clause built in buildOpsSearchJql with epic expansion
      return null;
    },
  },
  {
    id: "q",
    urlKey: "q",
    defaultValue: "",
    toJql: (value) => {
      const q = value.trim();
      if (!q) return null;
      if (ISSUE_KEY_RE.test(q)) {
        return `key = ${q.toUpperCase()}`;
      }
      return `summary ~ "${escapeJqlString(q)}"`;
    },
  },
];

export const OPS_FILTER_DEFAULTS: OpsFilterValues = {
  backlog: "1",
  type: "ALL",
  status: "ALL",
  version: "ALL",
  q: "",
};

export function parseOpsFilters(
  params: URLSearchParams | Record<string, string | null | undefined>
): OpsFilterValues {
  const get = (key: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(key);
    const v = params[key];
    return v == null ? null : String(v);
  };

  const out = { ...OPS_FILTER_DEFAULTS };
  for (const def of OPS_FILTER_DEFS) {
    const raw = get(def.urlKey);
    if (raw != null && raw !== "") {
      out[def.id] = raw;
    }
  }
  return out;
}

/** Build JQL clauses from active filters (AND). */
export function filtersToJqlClauses(
  values: OpsFilterValues,
  ctx?: { epicLinkJql?: string }
): string[] {
  const clauses: string[] = [];
  for (const def of OPS_FILTER_DEFS) {
    const fragment = def.toJql(values[def.id] ?? def.defaultValue, ctx);
    if (fragment) clauses.push(fragment);
  }
  return clauses;
}

/**
 * Fix Version match: issue owns the version, or is linked to an epic that owns it.
 * Prefer name when provided — some Jira Server setups resolve name more reliably than id.
 */
export function versionFilterJql(
  versionValue: string,
  epicKeysWithVersion: string[],
  epicLinkJql: string,
  versionName?: string | null
): string | null {
  if (!versionValue || versionValue === "ALL" || versionValue === "NONE") {
    return null;
  }

  const isId = /^\d+$/.test(versionValue);
  const parts: string[] = [];
  if (isId) {
    parts.push(`fixVersion = ${versionValue}`);
  }
  const name = (versionName || (!isId ? versionValue : "")).trim();
  if (name) {
    parts.push(`fixVersion = "${escapeJqlString(name)}"`);
  }
  if (parts.length === 0) {
    parts.push(`fixVersion = "${escapeJqlString(versionValue)}"`);
  }
  const fvClause = parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;

  if (epicKeysWithVersion.length === 0) {
    return fvClause;
  }

  const keys = epicKeysWithVersion.map((k) => `"${k}"`).join(", ");
  return `(${fvClause} OR ${epicLinkJql} in (${keys}))`;
}

export function buildOpsSearchJql(
  projectKey: string,
  values: OpsFilterValues,
  opts?: {
    epicLinkField?: string;
    /** Epic keys that already have the selected Fix Version (for inheritance). */
    epicKeysWithVersion?: string[];
    versionName?: string | null;
  }
): string {
  const epicLinkJql = epicLinkJqlToken(
    opts?.epicLinkField || "customfield_10014"
  );
  const clauses = [
    `project = '${projectKey}'`,
    // Ops list is parents only; sub-tasks load on demand per story
    "issuetype not in subTaskIssueTypes()",
    ...filtersToJqlClauses(values, { epicLinkJql }),
  ];

  const versionClause = versionFilterJql(
    values.version,
    opts?.epicKeysWithVersion || [],
    epicLinkJql,
    opts?.versionName
  );
  if (versionClause) clauses.push(versionClause);

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}
