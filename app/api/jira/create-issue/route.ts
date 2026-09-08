import { NextResponse } from "next/server";
import { convertToJiraWikiMarkup, getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { issue } = await req.json();
    if (!issue) {
      return NextResponse.json({ error: "Missing required parameters." }, { status: 400 });
    }

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicNameField = config.epicNameField;
    const epicLinkField = config.epicLinkField;

    const fields: Record<string, any> = {
      project: {
        key: projectKey,
      },
      summary: issue.summary,
      description: convertToJiraWikiMarkup(issue.description),
      issuetype: {
        name: issue.issuetype,
      },
      labels: ["agent"],
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

    if (issue.selectedRelease) {
      const isId = /^\d+$/.test(issue.selectedRelease);
      fields.fixVersions = [
        isId ? { id: issue.selectedRelease } : { name: issue.selectedRelease },
      ];
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
      issue.epicKey
    ) {
      fields[epicLinkField] = issue.epicKey.trim();
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
