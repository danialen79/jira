import { NextResponse } from "next/server";
import {
  addRecentWorklog,
  clearRecentWorklogs,
  listRecentWorklogs,
} from "@/lib/db/repos/recent-logs";

export async function GET() {
  try {
    return NextResponse.json({ logs: listRecentWorklogs() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to list recent logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.issueKey || !body?.summary || !body?.timeSpent) {
      return NextResponse.json(
        { error: "issueKey, summary, and timeSpent are required" },
        { status: 400 }
      );
    }
    const log = addRecentWorklog({
      issueKey: String(body.issueKey),
      summary: String(body.summary),
      parentKey: body.parentKey ? String(body.parentKey) : undefined,
      timeSpent: String(body.timeSpent),
      comment: body.comment ? String(body.comment) : "",
      url: body.url ? String(body.url) : "",
      timestamp: body.timestamp ? String(body.timestamp) : undefined,
    });
    return NextResponse.json({ log, logs: listRecentWorklogs() });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to add recent log" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    clearRecentWorklogs();
    return NextResponse.json({ ok: true, logs: [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to clear recent logs" },
      { status: 500 }
    );
  }
}
