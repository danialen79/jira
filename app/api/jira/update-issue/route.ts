import { NextResponse } from "next/server";
import { convertToJiraWikiMarkup, getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { issueKey, issue } = await req.json();
    if (!issueKey || !issue) {
      return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
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

    if (issue.selectedRelease !== undefined) {
      if (issue.selectedRelease) {
        const isId = /^\d+$/.test(issue.selectedRelease);
        fields.fixVersions = [
          isId ? { id: issue.selectedRelease } : { name: issue.selectedRelease },
        ];
      } else {
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
      issue.epicKey !== undefined
    ) {
      fields[epicLinkField] = issue.epicKey ? issue.epicKey.trim() : null;
    }

    const updateUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}`;
    console.log(`[Jira Refiner Server] Updating issue ${issueKey} at ${updateUrl}`);
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
