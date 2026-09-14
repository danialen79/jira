/** Normalize a Jira base URL (no trailing slash). */
export function normalizeJiraBase(url: string): string {
  return (url || "").trim().replace(/\/+$/, "");
}

/** Browse URL for an issue key, e.g. https://jira.example/browse/PROJ-1 */
export function jiraBrowseUrl(baseOrUrl: string, issueKey: string): string {
  const base = normalizeJiraBase(baseOrUrl);
  const key = (issueKey || "").trim();
  if (!base || !key) return "#";
  return `${base}/browse/${encodeURIComponent(key)}`;
}
