import { NextResponse } from "next/server";
import { applyLensToLabels, isStoryLens } from "@/lib/lens";
import { convertToJiraWikiMarkup, getJiraClient, JiraEnvError } from "@/lib/jira";
import {
  fixVersionValidationError,
  resolveFixVersionForWrite,
} from "@/lib/fix-version-policy";

export async function POST(req: Request) {
  try {
    const { issueKey, issue } = await req.json();
    if (!issueKey || !issue) {
      return NextResponse.json(
        { error: "Missing required parameters." },
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

    const epicKeyProvided = issue.epicKey !== undefined;
    const epicKeyRaw =
      typeof issue.epicKey === "string" ? issue.epicKey.trim() : "";
    const hasEpicLink = epicKeyProvided ? Boolean(epicKeyRaw) : false;

    if (issue.selectedRelease !== undefined && !hasEpicLink) {
      const fvError = fixVersionValidationError({
        issuetype: issue.issuetype || "Story",
        hasEpicLink: false,
        selectedRelease: issue.selectedRelease,
      });
      if (fvError) {
        return NextResponse.json({ error: fvError }, { status: 400 });
      }
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const epicNameField = config.epicNameField;
    const epicLinkField = config.epicLinkField;

    const fields: Record<string, any> = {
      summary: issue.summary,
      description: convertToJiraWikiMarkup(issue.description),
    };

    if (issue.selectedComponent !== undefined) {
      fields.components = issue.selectedComponent
        ? [{ name: issue.selectedComponent }]
        : [];
    }

    if (issue.selectedPriority) {
      fields.priority = { name: issue.selectedPriority };
    }

    if (issue.selectedAssignee !== undefined) {
      fields.assignee = issue.selectedAssignee
        ? { name: issue.selectedAssignee }
        : null;
    }

    if (issue.selectedRelease !== undefined || epicKeyProvided) {
      const fv = resolveFixVersionForWrite({
        issuetype: issue.issuetype || "Story",
        hasEpicLink,
        selectedRelease: issue.selectedRelease,
      });
      if (fv.clear || hasEpicLink) {
        fields.fixVersions = [];
      } else if (fv.value) {
        const isId = /^\d+$/.test(fv.value);
        fields.fixVersions = [
          isId ? { id: fv.value } : { name: fv.value },
        ];
      } else if (issue.selectedRelease !== undefined && !issue.selectedRelease) {
        fields.fixVersions = [];
      }
    }

    if (issue.selectedSprint !== undefined) {
      const sprintField = config.sprintFieldId || "customfield_10010";
      if (issue.selectedSprint) {
        const sprintIdNum = Number(issue.selectedSprint);
        if (!isNaN(sprintIdNum)) {
          fields[sprintField] = sprintIdNum;
        } else {
          fields[sprintField] = issue.selectedSprint;
        }
      } else {
        fields[sprintField] = null;
      }
    }

    if (issue.issuetype === "Epic") {
      fields[epicNameField] = issue.summary;
    }

    if (
      (issue.issuetype === "Story" || issue.issuetype === "Bug") &&
      epicKeyProvided
    ) {
      fields[epicLinkField] = epicKeyRaw ? epicKeyRaw : null;
    }

    if (issue.issuetype === "Story" && isStoryLens(issue.selectedLens)) {
      const getUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}?fields=labels`;
      const getRes = await fetch(getUrl, { method: "GET", headers });
      if (!getRes.ok) {
        const text = await getRes.text();
        return NextResponse.json(
          {
            error: `Failed to read current labels (${getRes.status}): ${text || getRes.statusText}`,
          },
          { status: getRes.status }
        );
      }
      const current = await getRes.json();
      const existingLabels: string[] = Array.isArray(current.fields?.labels)
        ? current.fields.labels
        : [];
      fields.labels = applyLensToLabels(existingLabels, issue.selectedLens);
    }

    const updateUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}`;
    console.log(
      `[Jira Refiner Server] Updating issue ${issueKey} at ${updateUrl}`
    );
    const response = await fetch(updateUrl, {
      method: "PUT",
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

    return NextResponse.json({
      success: true,
      key: issueKey,
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Issue Update Error:", err);
    return NextResponse.json(
      { error: `Failed to update issue in Jira: ${err.message}` },
      { status: 500 }
    );
  }
}
