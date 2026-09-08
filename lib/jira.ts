import type { ConnectionConfig, JiraCredentials } from "@/lib/types";

export type { JiraCredentials };

export class JiraEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JiraEnvError";
  }
}

export function isJiraEnvConfigured(): boolean {
  const url = process.env.JIRA_URL?.trim();
  if (!url) return false;
  const authType = (process.env.JIRA_AUTH_TYPE || "pat").toLowerCase();
  if (authType === "basic") {
    return !!(
      process.env.JIRA_USERNAME?.trim() && process.env.JIRA_PASSWORD?.trim()
    );
  }
  return !!(process.env.JIRA_TOKEN?.trim() || process.env.JIRA_PAT?.trim());
}

export function getJiraEnvCredentials(): JiraCredentials {
  const url = process.env.JIRA_URL?.trim();
  if (!url) {
    throw new JiraEnvError("JIRA_URL is not set in environment.");
  }

  const authTypeRaw = (process.env.JIRA_AUTH_TYPE || "pat").toLowerCase();
  const authType = authTypeRaw === "basic" ? "basic" : "pat";

  if (authType === "pat") {
    const token = process.env.JIRA_TOKEN?.trim() || process.env.JIRA_PAT?.trim();
    if (!token) {
      throw new JiraEnvError("JIRA_TOKEN (or JIRA_PAT) is not set.");
    }
    return { url, authType: "pat", token };
  }

  const username = process.env.JIRA_USERNAME?.trim();
  const password = process.env.JIRA_PASSWORD?.trim();
  if (!username || !password) {
    throw new JiraEnvError(
      "JIRA_USERNAME and JIRA_PASSWORD are required for basic auth."
    );
  }
  return { url, authType: "basic", username, password };
}

export function getJiraEnvProjectKey(): string {
  const key =
    process.env.JIRA_PROJECT?.trim() ||
    process.env.JIRA_DEFAULT_PROJECT?.trim();
  if (!key) {
    throw new JiraEnvError("JIRA_PROJECT is not set in environment.");
  }
  return key.toUpperCase();
}

export function getJiraEnvConfig(): ConnectionConfig {
  return {
    epicNameField:
      process.env.JIRA_EPIC_NAME_FIELD?.trim() || "customfield_10008",
    epicLinkField:
      process.env.JIRA_EPIC_LINK_FIELD?.trim() || "customfield_10014",
    sprintFieldId:
      process.env.JIRA_SPRINT_FIELD?.trim() || "customfield_10010",
  };
}

export function getJiraClient() {
  const creds = getJiraEnvCredentials();
  const jiraUrl = normalizeJiraUrl(creds.url);
  const headers = getJiraHeaders(creds);
  const projectKey = getJiraEnvProjectKey();
  const config = getJiraEnvConfig();
  return { creds, jiraUrl, headers, projectKey, config };
}

/** Public (non-secret) connection metadata for the UI. */
export function getJiraPublicEnvMeta() {
  const configured = isJiraEnvConfigured();
  const authTypeRaw = (process.env.JIRA_AUTH_TYPE || "pat").toLowerCase();
  const authType = authTypeRaw === "basic" ? "basic" : "pat";
  let url = "";
  let projectKey = "";
  try {
    if (process.env.JIRA_URL?.trim()) {
      url = normalizeJiraUrl(process.env.JIRA_URL);
    }
  } catch {
    url = process.env.JIRA_URL?.trim() || "";
  }
  try {
    if (
      process.env.JIRA_PROJECT?.trim() ||
      process.env.JIRA_DEFAULT_PROJECT?.trim()
    ) {
      projectKey = getJiraEnvProjectKey();
    }
  } catch {
    projectKey = "";
  }
  return {
    configured,
    authType: authType as "pat" | "basic",
    url,
    projectKey,
    config: getJiraEnvConfig(),
    missing: [
      !process.env.JIRA_URL?.trim() && "JIRA_URL",
      !(process.env.JIRA_PROJECT?.trim() ||
        process.env.JIRA_DEFAULT_PROJECT?.trim()) && "JIRA_PROJECT",
      authType === "pat" &&
        !(process.env.JIRA_TOKEN?.trim() || process.env.JIRA_PAT?.trim()) &&
        "JIRA_TOKEN",
      authType === "basic" &&
        !process.env.JIRA_USERNAME?.trim() &&
        "JIRA_USERNAME",
      authType === "basic" &&
        !process.env.JIRA_PASSWORD?.trim() &&
        "JIRA_PASSWORD",
    ].filter(Boolean) as string[],
  };
}

export function getJiraHeaders(creds: JiraCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (creds.authType === "pat") {
    if (!creds.token) throw new Error("Personal Access Token (PAT) is required.");
    headers["Authorization"] = `Bearer ${creds.token.trim()}`;
  } else {
    if (!creds.username || !creds.password) {
      throw new Error("Username and Password are required for Basic auth.");
    }
    const encoded = Buffer.from(
      `${creds.username.trim()}:${creds.password.trim()}`
    ).toString("base64");
    headers["Authorization"] = `Basic ${encoded}`;
  }

  return headers;
}

export function normalizeJiraUrl(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = "https://" + cleaned;
  }
  return cleaned;
}

export function sanitizeJiraText(text: string): string {
  if (!text) return "";
  let clean = text;
  // Remove Jira wiki headers like h1., h2., h3., h4., h5., h6.
  clean = clean.replace(/^h[1-6]\.\s*/gm, "");
  clean = clean.replace(/\nh[1-6]\.\s*/g, "\n");
  // Remove markdown checkboxes like * [ ] or - [ ] or [ ] or * [x]
  clean = clean.replace(/^[\*\-]\s*\[\s*x?\s*\]\s*/gm, "- ");
  clean = clean.replace(/^\[\s*x?\s*\]\s*/gm, "- ");
  // Remove bold/italic asterisks & underscores e.g. *به عنوان* -> به عنوان, **word** -> word, _word_ -> word
  clean = clean.replace(/\*\*([^*]+)\*\*/g, "$1");
  clean = clean.replace(/\*([^*]+)\*/g, "$1");
  clean = clean.replace(/_([^_]+)_/g, "$1");
  // Remove leftover h1.-h6. tags anywhere in text if any remain
  clean = clean.replace(/h[1-6]\.\s*/g, "");
  return clean.trim();
}

export function convertToJiraWikiMarkup(markdown: string): string {
  if (!markdown) return "";

  const lines = markdown.split(/\r?\n/);
  const convertedLines = lines.map((line) => {
    // 1. Convert headers: e.g. "### Header" -> "h3. Header"
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      return `h${level}. ${headingMatch[2]}`;
    }

    // 2. Convert numbered list items: e.g. "1. text" or "۱. text" -> "# text"
    const numberedMatch = line.match(/^(\s*)(\d+|[\u06f0-\u06f9]+)[.)]\s+(.*)$/);
    if (numberedMatch) {
      return `${numberedMatch[1]}# ${numberedMatch[3]}`;
    }

    // 3. Convert normal bullet lists: e.g. "- text" -> "* text"
    const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (bulletMatch) {
      return `${bulletMatch[1]}* ${bulletMatch[3]}`;
    }

    return line;
  });

  let text = convertedLines.join("\n");

  // 4. Convert bold text: "**text**" or "__text__" -> "*text*"
  text = text.replace(/\*\*(.*?)\*\*/g, "*$1*");
  text = text.replace(/__(.*?)__/g, "*$1*");

  return text;
}
