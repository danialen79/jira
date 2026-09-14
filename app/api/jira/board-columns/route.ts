import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import type { BoardColumnDef } from "@/lib/daily-board/types";

type AgileBoard = { id: number; name: string; type: string };

function categoryFromStatuses(
  statuses: Array<{ category: string }>
): string {
  const keys = statuses.map((s) => s.category.toLowerCase());
  if (keys.some((k) => k === "done")) return "done";
  if (keys.some((k) => k === "indeterminate")) return "indeterminate";
  if (keys.some((k) => k === "new")) return "new";
  return statuses[0]?.category || "new";
}

function pickDropStatusName(
  columnName: string,
  statusNames: string[]
): string | null {
  if (statusNames.length === 0) return null;
  const colLower = columnName.trim().toLowerCase();
  const exact = statusNames.find((n) => n.toLowerCase() === colLower);
  if (exact) return exact;
  return statusNames[0];
}

/** Pull Test PM out of In Progress into its own daily-board column. */
function ensureDedicatedTestPmColumn(
  columns: BoardColumnDef[]
): BoardColumnDef[] {
  const TEST_PM = "Test PM";
  const cleaned = columns.map((col) => {
    const statusNames = col.statusNames.filter(
      (n) => n.toLowerCase() !== "test pm"
    );
    return {
      ...col,
      statusNames,
      dropStatusName: pickDropStatusName(col.name, statusNames),
    };
  });

  if (cleaned.some((c) => c.name.toLowerCase() === "test pm")) {
    return cleaned;
  }

  const testPmCol: BoardColumnDef = {
    name: TEST_PM,
    category: "indeterminate",
    statusNames: [TEST_PM],
    dropStatusName: TEST_PM,
  };

  const doneIdx = cleaned.findIndex(
    (c) =>
      c.category === "done" ||
      c.name.toLowerCase() === "done" ||
      c.statusNames.some((n) => n.toLowerCase() === "done")
  );
  if (doneIdx >= 0) {
    return [
      ...cleaned.slice(0, doneIdx),
      testPmCol,
      ...cleaned.slice(doneIdx),
    ];
  }
  return [...cleaned, testPmCol];
}

async function listBoards(
  jiraUrl: string,
  headers: Record<string, string>,
  projectKey: string
): Promise<AgileBoard[]> {
  const res = await fetch(
    `${jiraUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}&maxResults=50`,
    { method: "GET", headers }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.values || []) as Array<Record<string, unknown>>)
    .map((b) => ({
      id: Number(b.id),
      name: String(b.name || ""),
      type: String(b.type || ""),
    }))
    .filter((b) => Number.isFinite(b.id) && b.id > 0);
}

function resolveProductBoard(boards: AgileBoard[]): AgileBoard | null {
  const envId = Number(process.env.JIRA_DAILY_BOARD_ID || "");
  if (Number.isFinite(envId) && envId > 0) {
    const byId = boards.find((b) => b.id === envId);
    if (byId) return byId;
  }
  const envName = (process.env.JIRA_DAILY_BOARD_NAME || "Product").trim();
  const byName = boards.find(
    (b) => b.name.toLowerCase() === envName.toLowerCase()
  );
  if (byName) return byName;
  const productish = boards.find((b) =>
    /product/i.test(b.name)
  );
  if (productish) return productish;
  const kanban = boards.find((b) => b.type === "kanban");
  return kanban || boards[0] || null;
}

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();
    const boards = await listBoards(jiraUrl, headers, projectKey);
    const board = resolveProductBoard(boards);
    if (!board) {
      return NextResponse.json(
        { error: "No Jira board found for this project." },
        { status: 404 }
      );
    }

    const cfgRes = await fetch(
      `${jiraUrl}/rest/agile/1.0/board/${board.id}/configuration`,
      { method: "GET", headers }
    );
    if (!cfgRes.ok) {
      const text = await cfgRes.text();
      return NextResponse.json(
        {
          error: `Failed to fetch board configuration (${cfgRes.status}): ${text || cfgRes.statusText}`,
        },
        { status: cfgRes.status }
      );
    }

    const cfg = await cfgRes.json();
    const rawColumns: Array<{
      name?: string;
      statuses?: Array<{ id?: string; name?: string }>;
    }> = cfg.columnConfig?.columns || [];

    const statusRes = await fetch(
      `${jiraUrl}/rest/api/2/project/${encodeURIComponent(projectKey)}/statuses`,
      { method: "GET", headers }
    );
    const statusById = new Map<
      string,
      { name: string; category: string }
    >();
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      for (const issueType of statusData || []) {
        for (const s of issueType.statuses || []) {
          const id = String(s.id);
          if (!statusById.has(id)) {
            statusById.set(id, {
              name: String(s.name || ""),
              category: String(
                s.statusCategory?.key || s.statusCategory?.name || "new"
              ).toLowerCase(),
            });
          }
        }
      }
    }

    const columns: BoardColumnDef[] = rawColumns.map((col) => {
      const name = String(col.name || "Column").trim() || "Column";
      const resolved = (col.statuses || [])
        .map((st) => {
          const id = String(st.id || "");
          const fromMap = statusById.get(id);
          const statusName = (st.name || fromMap?.name || "").trim();
          if (!statusName) return null;
          return {
            name: statusName,
            category: fromMap?.category || "new",
          };
        })
        .filter((s): s is { name: string; category: string } => !!s);

      // Dedupe by status name (case-insensitive)
      const seen = new Set<string>();
      const statusNames: string[] = [];
      const cats: Array<{ category: string }> = [];
      for (const s of resolved) {
        const key = s.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        statusNames.push(s.name);
        cats.push({ category: s.category });
      }

      return {
        name,
        category: categoryFromStatuses(cats),
        statusNames,
        dropStatusName: pickDropStatusName(name, statusNames),
      };
    });

    const columnsWithTestPm = ensureDedicatedTestPmColumn(columns);

    return NextResponse.json({
      success: true,
      board: { id: board.id, name: board.name, type: board.type },
      columns: columnsWithTestPm,
      projectKey,
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Failed";
    console.error("Board columns fetch error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
