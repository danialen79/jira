import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { issueKey } = await req.json();
    if (!issueKey) {
      return NextResponse.json(
        { error: "Missing required parameters (issueKey)." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers } = getJiraClient();

    const transitionsUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}/transitions`;
    const getResponse = await fetch(transitionsUrl, {
      method: "GET",
      headers,
    });

    if (!getResponse.ok) {
      const text = await getResponse.text();
      return NextResponse.json(
        {
          error: `Failed to fetch transitions from Jira: ${text || getResponse.statusText}`,
        },
        { status: getResponse.status }
      );
    }

    const transitionData = await getResponse.json();
    const transitions = transitionData.transitions || [];

    const doneKeywords = [
      "done",
      "تکمیل",
      "بستن",
      "close",
      "resolve",
      "پایان",
      "تکمیل شده",
    ];
    let selectedTransition = transitions.find((t: any) => {
      const name = (t.name || "").toLowerCase();
      const toName = (t.to?.name || "").toLowerCase();
      return doneKeywords.some(
        (keyword) => name.includes(keyword) || toName.includes(keyword)
      );
    });

    if (!selectedTransition) {
      selectedTransition = transitions.find((t: any) => {
        const category = (t.to?.statusCategory?.name || "").toLowerCase();
        return category === "done" || category === "complete";
      });
    }

    if (!selectedTransition) {
      return NextResponse.json({
        success: false,
        message:
          "No 'Done' transition found. Available transitions are: " +
          transitions.map((t: any) => t.name).join(", "),
      });
    }

    const postResponse = await fetch(transitionsUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transition: {
          id: selectedTransition.id,
        },
      }),
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      return NextResponse.json(
        {
          error: `Failed to execute transition to '${selectedTransition.name}' (${selectedTransition.id}): ${text || postResponse.statusText}`,
        },
        { status: postResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      transitionedTo: selectedTransition.name,
      transitionId: selectedTransition.id,
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Transition to Done Error:", err);
    return NextResponse.json(
      { error: `Failed to transition issue: ${err.message}` },
      { status: 500 }
    );
  }
}
