import { NextResponse } from "next/server";
import {
  applyLensToLabels,
  isIssueLens,
  isLensLabel,
  isStoryLens,
} from "@/lib/lens";
import {
  convertToJiraWikiMarkup,
  getJiraClient,
  getJiraSupportProjectKey,
  JiraEnvError,
} from "@/lib/jira";
import {
  fixVersionValidationError,
  resolveFixVersionForWrite,
} from "@/lib/fix-version-policy";
import {
  addJiraComment,
  createJiraIssueLink,
  isSupportIssueKey,
} from "@/lib/support";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const psKey = String(body.psKey || "").trim().toUpperCase();
    const issue = body.issue;
    if (!psKey || !issue) {
      return NextResponse.json(
        { error: "psKey and issue are required." },
        { status: 400 }
      );
    }

    const supportProjectKey = getJiraSupportProjectKey();
    if (!isSupportIssueKey(psKey, supportProjectKey)) {
      return NextResponse.json(
        { error: `psKey must belong to ${supportProjectKey}.` },
        { status: 400 }
      );
    }

    if (issue.issuetype === "Story" && !isStoryLens(issue.selectedLens)) {
      return NextResponse.json(
        {
          error:
            "Story requires a Lens (strategy, vision, customer, or business).",
        },
        { status: 400 }
      );
    }

    const epicKeyRaw =
      typeof issue.epicKey === "string" ? issue.epicKey.trim() : "";
    const hasEpicLink = Boolean(epicKeyRaw);
    const fvError = fixVersionValidationError({
      issuetype: issue.issuetype || "Story",
      hasEpicLink,
      selectedRelease: issue.selectedRelease,
    });
    if (fvError) {
      return NextResponse.json({ error: fvError }, { status: 400 });
    }

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicNameField = config.epicNameField;
    const epicLinkField = config.epicLinkField;

    const suggested = Array.isArray(issue.suggestedLabels)
      ? (issue.suggestedLabels as string[]).filter(
          (l: unknown) => typeof l === "string" && String(l).trim() && !isLensLabel(String(l))
        )
      : [];

    const baseLabels = ["agent", "from-ps", ...suggested];
    const fields: Record<string, unknown> = {
      project: { key: projectKey },
      summary: issue.summary,
      description: convertToJiraWikiMarkup(issue.description || ""),
      issuetype: { name: issue.issuetype },
      labels: applyLensToLabels(
        baseLabels,
        issue.issuetype === "Story" || issue.issuetype === "Epic"
          ? isIssueLens(issue.selectedLens)
            ? issue.selectedLens
            : null
          : null
      ),
    };

    if (issue.selectedComponent) {
      fields.components = [{ name: issue.selectedComponent }];
    }
    if (issue.selectedPriority) {
      fields.priority = { name: issue.selectedPriority };
    }
    if (issue.selectedAssignee) {
      fields.assignee = { name: issue.selectedAssignee };
    }

    const fv = resolveFixVersionForWrite({
      issuetype: issue.issuetype || "Story",
      hasEpicLink,
      selectedRelease: issue.selectedRelease,
    });
    if (fv.clear) {
      fields.fixVersions = [];
    } else if (fv.value) {
      const isId = /^\d+$/.test(fv.value);
      fields.fixVersions = [isId ? { id: fv.value } : { name: fv.value }];
    }

    if (
      (issue.issuetype === "Story" || issue.issuetype === "Bug") &&
      issue.selectedSprint
    ) {
      const sprintField = config.sprintFieldId || "customfield_10010";
      const sprintIdNum = Number(issue.selectedSprint);
      fields[sprintField] = !isNaN(sprintIdNum)
        ? sprintIdNum
        : issue.selectedSprint;
    }

    if (issue.issuetype === "Epic") {
      fields[epicNameField] = issue.summary;
    }

    if (
      (issue.issuetype === "Story" || issue.issuetype === "Bug") &&
      hasEpicLink
    ) {
      fields[epicLinkField] = epicKeyRaw;
    }

    const createRes = await fetch(`${jiraUrl}/rest/api/2/issue`, {
      method: "POST",
      headers,
      body: JSON.stringify({ fields }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
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
        // raw
      }
      return NextResponse.json(
        {
          error: `Create failed (${createRes.status}): ${parsedError || createRes.statusText}`,
        },
        { status: createRes.status }
      );
    }

    const created = await createRes.json();
    const sipKey = String(created.key || "").toUpperCase();

    const linkResult = await createJiraIssueLink({
      jiraUrl,
      headers,
      inwardKey: psKey,
      outwardKey: sipKey,
      typeName: "Relates",
    });

    let commentOk = false;
    if (linkResult.ok) {
      const comment = await addJiraComment({
        jiraUrl,
        headers,
        issueKey: psKey,
        body: `Linked ${sipKey}`,
      });
      commentOk = comment.ok;
    }

    return NextResponse.json({
      success: true,
      psKey,
      sipKey,
      linkOk: linkResult.ok,
      linkError: linkResult.ok ? undefined : linkResult.error,
      commentOk,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Support promote error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
