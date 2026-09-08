import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { isEpicIssueType } from "@/lib/fix-version-policy";

type Body = {
  issueKey?: string;
  /** Target Fix Version id; null/empty clears. */
  fixVersionId?: string | null;
  /** When moving an Epic, also clear this version from children that still carry it. */
  clearChildrenFromVersionId?: string | null;
};

async function setIssueFixVersion(
  jiraUrl: string,
  headers: HeadersInit,
  issueKey: string,
  fixVersionId: string | null
): Promise<void> {
  const fields =
    fixVersionId && String(fixVersionId).trim()
      ? { fixVersions: [{ id: String(fixVersionId).trim() }] }
      : { fixVersions: [] };

  const res = await fetch(`${jiraUrl}/rest/api/2/issue/${issueKey}`, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Failed to update ${issueKey} (${res.status}): ${text || res.statusText}`
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const issueKey = body.issueKey?.trim().toUpperCase();
    if (!issueKey) {
      return NextResponse.json(
        { error: "issueKey is required." },
        { status: 400 }
      );
    }

    const fixVersionId =
      body.fixVersionId != null && String(body.fixVersionId).trim()
        ? String(body.fixVersionId).trim()
        : null;

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";

    await setIssueFixVersion(jiraUrl, headers, issueKey, fixVersionId);

    let clearedChildren: string[] = [];
    const fromVersionId = body.clearChildrenFromVersionId?.trim();

    if (fromVersionId) {
      const metaRes = await fetch(
        `${jiraUrl}/rest/api/2/issue/${issueKey}?fields=issuetype`,
        { headers }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        const typeName = meta.fields?.issuetype?.name || "";
        if (isEpicIssueType(typeName)) {
          const cfNumber = epicLinkField.startsWith("customfield_")
            ? epicLinkField.replace("customfield_", "")
            : null;
          const jqlCandidates = [
            cfNumber
              ? `project = "${projectKey}" AND fixVersion = ${fromVersionId} AND (cf[${cfNumber}] = ${issueKey} OR "Epic Link" = ${issueKey} OR parent = ${issueKey})`
              : null,
            `project = "${projectKey}" AND fixVersion = ${fromVersionId} AND ("Epic Link" = ${issueKey} OR parent = ${issueKey})`,
          ].filter(Boolean) as string[];

          for (const jql of jqlCandidates) {
            try {
              const searchRes = await fetch(`${jiraUrl}/rest/api/2/search`, {
                method: "POST",
                headers: {
                  ...headers,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  jql,
                  maxResults: 100,
                  fields: ["summary"],
                }),
              });
              if (!searchRes.ok) continue;
              const data = await searchRes.json();
              const kids: { key: string }[] = data.issues || [];
              for (const kid of kids) {
                if (kid.key === issueKey) continue;
                await setIssueFixVersion(jiraUrl, headers, kid.key, null);
                clearedChildren.push(kid.key);
              }
              break;
            } catch {
              // try next JQL
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      key: issueKey,
      fixVersionId,
      clearedChildren,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Set Fix Version Error:", err);
    return NextResponse.json(
      { error: `Failed to set Fix Version: ${message}` },
      { status: 500 }
    );
  }
}
