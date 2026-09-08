import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey, config, creds } = getJiraClient();

    const response = await fetch(`${jiraUrl}/rest/api/2/myself`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          success: false,
          connected: false,
          configured: true,
          url: jiraUrl,
          projectKey,
          authType: creds.authType,
          config,
          error: `Jira Server returned an error (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      connected: true,
      configured: true,
      url: jiraUrl,
      projectKey,
      authType: creds.authType,
      config,
      user: {
        name: data.name,
        displayName: data.displayName,
        emailAddress: data.emailAddress,
        active: data.active,
      },
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json(
        { success: false, connected: false, configured: false, error: err.message },
        { status: 503 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Test Connection Error:", err);
    return NextResponse.json(
      {
        success: false,
        connected: false,
        error: `Failed to connect to Jira Server: ${message}`,
      },
      { status: 500 }
    );
  }
}
