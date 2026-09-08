import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const boardRes = await fetch(
      `${jiraUrl}/rest/agile/1.0/board?projectKeyOrId=${projectKey}`,
      {
        method: "GET",
        headers,
      }
    );

    if (!boardRes.ok) {
      console.warn(`Jira Agile Board API returned status ${boardRes.status}`);
      return NextResponse.json({ success: true, sprints: [], projectKey });
    }

    const boardData = await boardRes.json();
    const boards = boardData.values || [];
    const scrumBoards = boards.filter((b: any) => b.type === "scrum");

    const sprints: any[] = [];
    const seenSprints = new Set<number>();

    for (const board of scrumBoards) {
      try {
        const sprintRes = await fetch(
          `${jiraUrl}/rest/agile/1.0/board/${board.id}/sprint?state=active,future`,
          {
            method: "GET",
            headers,
          }
        );
        if (sprintRes.ok) {
          const sprintData = await sprintRes.json();
          const list = sprintData.values || [];
          for (const s of list) {
            if (!seenSprints.has(s.id)) {
              seenSprints.add(s.id);
              sprints.push({
                id: s.id,
                name: s.name,
                state: s.state,
                boardName: board.name,
              });
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching sprints for board ${board.id}:`, e);
      }
    }

    return NextResponse.json({ success: true, sprints, projectKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Sprints Fetch Error:", err);
    return NextResponse.json({ success: true, sprints: [] });
  }
}
