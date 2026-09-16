import {
  backlogJqlFragment,
  epicLinkJqlToken,
  incompletenessFromFilters,
} from "@/lib/issue-ops/backlog";
import type { OpsFilterValues } from "@/lib/issue-ops/types";

export type FilterDef = {
  id: keyof OpsFilterValues;
  urlKey: string;
  defaultValue: string;
  /** When false, value is only used by backlogJqlFragment / post-filters. */
  toJql: (value: string, ctx?: { epicLinkJql?: string }) => string | null;
};

const ISSUE_KEY_RE = /^[A-Z][A-Z0-9]+-\d+$/i;

function escapeJqlString(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Comma-separated Jira usernames in filter state / URL. */
export function parseAssigneeList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

export function serializeAssigneeList(names: string[]): string {
  return parseAssigneeList(names.join(",")).join(",");
}

export function hasAssigneeFilter(raw: string): boolean {
  return parseAssigneeList(raw).length > 0;
}

export const OPS_FILTER_DEFS: FilterDef[] = [
  {
    id: "missRelease",
    urlKey: "rel",
    defaultValue: "1",
    toJql: () => null,
  },
  {
    id: "missAssign",
    urlKey: "asn",
    defaultValue: "1",
    toJql: () => null,
  },
  {
    id: "missLens",
    urlKey: "lens",
    defaultValue: "1",
    toJql: () => null,
  },
  {
    id: "missComponent",
    urlKey: "cmp",
    defaultValue: "1",
    toJql: () => null,
  },
  {
    id: "assignee",
    urlKey: "asg",
    defaultValue: "",
    toJql: (value) => {
      const names = parseAssigneeList(value);
      if (names.length === 0) return null;
      if (names.length === 1) {
        return `assignee = "${escapeJqlString(names[0]!)}"`;
      }
      const quoted = names
        .map((n) => `"${escapeJqlString(n)}"`)
        .join(", ");
      return `assignee in (${quoted})`;
    },
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
  missRelease: "1",
  missAssign: "1",
  missLens: "1",
  missComponent: "1",
  assignee: "",
  type: "ALL",
  status: "ALL",
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
  // Specific assignees and "missing assign" cannot both apply.
  if (hasAssigneeFilter(out.assignee)) {
    out.missAssign = "0";
    out.assignee = serializeAssigneeList(parseAssigneeList(out.assignee));
  }
  return out;
}

/** Build JQL clauses from type/status/q filters (AND). */
export function filtersToJqlClauses(
  values: OpsFilterValues,
  ctx?: { epicLinkJql?: string }
): string[] {
  const clauses: string[] = [];
  for (const def of OPS_FILTER_DEFS) {
    if (
      def.id === "missRelease" ||
      def.id === "missAssign" ||
      def.id === "missLens" ||
      def.id === "missComponent"
    ) {
      continue;
    }
    const fragment = def.toJql(values[def.id] ?? def.defaultValue, ctx);
    if (fragment) clauses.push(fragment);
  }
  return clauses;
}

export function buildOpsSearchJql(
  projectKey: string,
  values: OpsFilterValues,
  opts?: {
    epicLinkField?: string;
  }
): string {
  const epicLinkJql = epicLinkJqlToken(
    opts?.epicLinkField || "customfield_10014"
  );
  const incompleteness = incompletenessFromFilters(values);
  // Specific assignees override the "missing assign" incompleteness gate.
  if (hasAssigneeFilter(values.assignee)) {
    incompleteness.assign = false;
  }
  const clauses = [
    `project = '${projectKey}'`,
    // List is parents only; sub-tasks / epic children load on demand
    "issuetype not in subTaskIssueTypes()",
    backlogJqlFragment(epicLinkJql, incompleteness),
    ...filtersToJqlClauses(values, { epicLinkJql }),
  ];

  return `${clauses.join(" AND ")} ORDER BY updated DESC`;
}
