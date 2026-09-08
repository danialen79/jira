import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { versionId, updateData } = await req.json();
    if (!versionId) {
      return NextResponse.json(
        { error: "Version ID is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();

    const response = await fetch(`${jiraUrl}/rest/api/2/version/${versionId}`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to update version (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, version: data });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Version Update Error:", err);
    return NextResponse.json(
      { error: `Failed to update version: ${err.message}` },
      { status: 500 }
    );
  }
}
