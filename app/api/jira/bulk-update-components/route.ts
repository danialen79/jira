import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { updates } = await req.json();
    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { error: "Missing required parameters (updates array)." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();

    const results: Array<{ issueKey: string; success: boolean; error?: string }> = [];

    for (const item of updates) {
      const { issueKey, components } = item;
      if (!issueKey || !Array.isArray(components)) continue;

      try {
        const updateUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}`;
        const compObjects = components.map((c: string) => ({ name: c }));

        const response = await fetch(updateUrl, {
          method: "PUT",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fields: {
              components: compObjects,
            },
          }),
        });

        if (response.ok || response.status === 204) {
          results.push({ issueKey, success: true });
        } else {
          const errText = await response.text();
          results.push({
            issueKey,
            success: false,
            error: `Jira error (${response.status}): ${errText}`,
          });
        }
      } catch (err: any) {
        results.push({ issueKey, success: false, error: err.message });
      }
    }

    const updatedCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: true,
      updatedCount,
      totalRequested: updates.length,
      results,
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Bulk Update Components Error:", err);
    return NextResponse.json(
      { error: `Bulk update failed: ${err.message}` },
      { status: 500 }
    );
  }
}
