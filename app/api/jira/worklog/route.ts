import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { issueKey, timeSpent, comment, started } = await req.json();
    if (!issueKey || !timeSpent) {
      return NextResponse.json(
        { error: "Missing required parameters (issueKey, timeSpent)." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();

    const worklogUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}/worklog`;
    console.log(
      `[Jira Server] Recording worklog for ${issueKey}: ${timeSpent} (${comment}) ${started ? `started at ${started}` : ""}`
    );

    const bodyData: Record<string, any> = {
      comment: comment || "",
      timeSpent: timeSpent,
    };

    if (started) {
      let jiraStarted = started;
      if (typeof started === "string") {
        if (started.endsWith("Z")) {
          jiraStarted = started.replace(/Z$/, "+0000");
        } else if (started.endsWith("+00:00")) {
          jiraStarted = started.replace(/\+00:00$/, "+0000");
        }
      }
      bodyData.started = jiraStarted;
    }

    const response = await fetch(worklogUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyData),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Jira returned an error (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, worklog: data });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Worklog Error:", err);
    return NextResponse.json(
      { error: `Failed to log work: ${err.message}` },
      { status: 500 }
    );
  }
}
