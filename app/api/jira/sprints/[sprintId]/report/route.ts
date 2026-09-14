import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import { JiraBoardConfigError, requireScrumBoard } from "@/lib/jira-board";
import {
  fetchAllSprintIssues,
  mapAgileSprint,
  statusBucket,
} from "@/lib/sprint/map";
import {
  computeHealth,
  parseGreenhopperBurndown,
  parseGreenhopperSprintReport,
  synthesizeBurndown,
  type VelocityBar,
} from "@/lib/sprint/metrics";

type Ctx = { params: Promise<{ sprintId: string }> };

async function safeJson(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data };
  } catch (err: unknown) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(_request: Request, context: Ctx) {
  try {
    const board = requireScrumBoard();
    const { sprintId } = await context.params;
    const id = Number(sprintId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid sprintId" }, { status: 400 });
    }

    const { jiraUrl, headers } = getJiraClient();

    const [sprintRes, issues, ghReport, ghBurndown, closedRes] =
      await Promise.all([
        safeJson(`${jiraUrl}/rest/agile/1.0/sprint/${id}`, headers),
        fetchAllSprintIssues(jiraUrl, headers, board.boardId, id),
        safeJson(
          `${jiraUrl}/rest/greenhopper/1.0/rapid/charts/sprintreport?rapidViewId=${board.boardId}&sprintId=${id}`,
          headers
        ),
        safeJson(
          `${jiraUrl}/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=${board.boardId}&sprintId=${id}`,
          headers
        ),
        fetch(
          `${jiraUrl}/rest/agile/1.0/board/${board.boardId}/sprint?state=closed&maxResults=5`,
          { method: "GET", headers }
        ),
      ]);

    if (!sprintRes.ok) {
      return NextResponse.json(
        { error: `Sprint not found (${sprintRes.status})` },
        { status: sprintRes.status || 404 }
      );
    }

    const sprint = mapAgileSprint(sprintRes.data as Record<string, unknown>, {
      id: board.boardId,
      name: board.boardName,
    });

    const health = computeHealth(issues, sprint.endDate);
    const remainingCount = health.todo + health.inProgress;

    let scopeLimited = true;
    let added: Array<{ key: string; summary?: string }> = [];
    let removed: Array<{ key: string; summary?: string }> = [];
    let completedKeys: string[] = [];
    let notCompletedKeys: string[] = [];
    let commitmentReliability: number | null = null;

    if (ghReport.ok && ghReport.data) {
      scopeLimited = false;
      const parsed = parseGreenhopperSprintReport(ghReport.data);
      completedKeys = parsed.completedKeys;
      notCompletedKeys = parsed.notCompletedKeys;
      const issueByKey = new Map(issues.map((i) => [i.key, i]));
      added = parsed.addedKeys.map((key) => ({
        key,
        summary: issueByKey.get(key)?.summary,
      }));
      removed = parsed.puntedKeys.map((key) => ({
        key,
        summary: undefined,
      }));

      const originalCommitted =
        completedKeys.length +
        notCompletedKeys.length -
        parsed.addedKeys.filter((k) =>
          [...completedKeys, ...notCompletedKeys].includes(k)
        ).length;
      // Simpler reliability: completed / (completed + notCompleted) excluding mid-sprint adds when possible
      const baselineCompleted = completedKeys.filter(
        (k) => !parsed.addedKeys.includes(k)
      ).length;
      const baselineTotal =
        baselineCompleted +
        notCompletedKeys.filter((k) => !parsed.addedKeys.includes(k)).length;
      if (baselineTotal > 0) {
        commitmentReliability = Math.round(
          (baselineCompleted / baselineTotal) * 100
        );
      } else if (completedKeys.length + notCompletedKeys.length > 0) {
        commitmentReliability = Math.round(
          (completedKeys.length /
            (completedKeys.length + notCompletedKeys.length)) *
            100
        );
      }
      void originalCommitted;
    } else {
      // Fallback scope: none; reliability from current status
      if (health.total > 0) {
        commitmentReliability = health.percentDone;
      }
    }

    let burndownLimited = true;
    let burndown = synthesizeBurndown(
      sprint.startDate,
      sprint.endDate,
      health.total || remainingCount,
      remainingCount
    ).points;

    if (ghBurndown.ok && ghBurndown.data) {
      const parsed = parseGreenhopperBurndown(
        ghBurndown.data,
        sprint.startDate,
        sprint.endDate,
        health.total
      );
      if (parsed && parsed.length > 0) {
        burndown = parsed;
        burndownLimited = false;
      }
    }

    // Velocity from recent closed sprints
    const velocity: VelocityBar[] = [];
    if (closedRes.ok) {
      const closedData = await closedRes.json();
      const closed = (
        (closedData.values || []) as Array<Record<string, unknown>>
      )
        .map((s) =>
          mapAgileSprint(s, { id: board.boardId, name: board.boardName })
        )
        .slice(0, 5);

      for (const cs of closed) {
        try {
          const closedIssues = await fetchAllSprintIssues(
            jiraUrl,
            headers,
            board.boardId,
            cs.id
          );
          const completed = closedIssues.filter(
            (i) => statusBucket(i.statusCategoryKey) === "done"
          ).length;
          velocity.push({
            sprintId: cs.id,
            name: cs.name,
            completed,
            committed: closedIssues.length,
            hoursCompleted: closedIssues
              .filter((i) => statusBucket(i.statusCategoryKey) === "done")
              .reduce(
                (sum, i) =>
                  sum +
                  Math.round(((i.timespent || i.timeoriginalestimate || 0) / 3600) * 10) /
                    10,
                0
              ),
          });
        } catch {
          // skip sprint on error
        }
      }
    }

    const avgVelocity =
      velocity.length > 0
        ? Math.round(
            (velocity.reduce((s, v) => s + v.completed, 0) / velocity.length) *
              10
          ) / 10
        : null;

    return NextResponse.json({
      success: true,
      sprint,
      board,
      health,
      scope: {
        added,
        removed,
        addedCount: added.length,
        removedCount: removed.length,
        limited: scopeLimited,
      },
      commitmentReliability,
      burndown: {
        points: burndown,
        limited: burndownLimited,
      },
      velocity: {
        bars: velocity.reverse(),
        averageCompleted: avgVelocity,
        currentCommitted: health.total,
      },
      greenhopper: {
        report: ghReport.ok,
        burndown: ghBurndown.ok && !burndownLimited,
      },
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError || err instanceof JiraBoardConfigError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Sprint report error:", err);
    return NextResponse.json(
      { error: `Failed to build sprint report: ${message}` },
      { status: 500 }
    );
  }
}
