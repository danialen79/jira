import { NextResponse } from "next/server";
import {
  applyLensToLabels,
  isLensLabel,
  isStoryLens,
} from "@/lib/lens";
import { convertToJiraWikiMarkup, getJiraClient, JiraEnvError } from "@/lib/jira";
import {
  fixVersionValidationError,
  resolveFixVersionForWrite,
} from "@/lib/fix-version-policy";

export async function POST(req: Request) {
  try {
    const { issue } = await req.json();
    if (!issue) {
      return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
    }

    if (issue.issuetype === "Story" && !isStoryLens(issue.selectedLens)) {
      return NextResponse.json(
        { error: "Story requires a Lens (strategy, vision, customer, or business)." },
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
          (l) => typeof l === "string" && l.trim() && !isLensLabel(l)
        )
      : [];

    const fields: Record<string, any> = {
      project: {
        key: projectKey,
      },
      summary: issue.summary,
      description: convertToJiraWikiMarkup(issue.description),
      issuetype: {
        name: issue.issuetype,
      },
      labels: applyLensToLabels(
        ["agent", ...suggested],
        issue.issuetype === "Story" ? issue.selectedLens : null
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
      if (!isNaN(sprintIdNum)) {
        fields[sprintField] = sprintIdNum;
      } else {
        fields[sprintField] = issue.selectedSprint;
      }
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

    if (issue.issuetype === "Sub-task" && issue.parentKey) {
      fields.parent = { key: issue.parentKey.trim().toUpperCase() };
    }

    const createUrl = `${jiraUrl}/rest/api/2/issue`;
    const response = await fetch(createUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
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
        // use raw text
      }

      return NextResponse.json(
        {
          error: `Jira returned an error (${response.status}): ${parsedError || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      key: data.key,
      id: data.id,
      self: data.self,
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Issue Creation Error:", err);
    return NextResponse.json(
      { error: `Failed to create issue in Jira: ${err.message}` },
      { status: 500 }
    );
  }
}
