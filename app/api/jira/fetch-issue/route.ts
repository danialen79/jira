import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { issueKey } = await req.json();
    if (!issueKey) {
      return NextResponse.json({ error: "issueKey is required." }, { status: 400 });
    }

    const { jiraUrl, headers } = getJiraClient();
    const fetchUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}`;

    console.log(`[Jira Refiner Server] Fetching issue ${issueKey} from ${fetchUrl}`);
    const response = await fetch(fetchUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira returned status ${response.status}: ${text}`);
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      issue: {
        key: data.key,
        summary: data.fields?.summary || "",
        description: data.fields?.description || "",
        issuetype: data.fields?.issuetype?.name || "Story",
        priority: data.fields?.priority?.name || "Medium",
        component: data.fields?.components?.[0]?.name || "",
        assignee: data.fields?.assignee?.name || "",
        status: data.fields?.status?.name || "",
      },
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Fetch Issue Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
