import { NextResponse } from "next/server";
import {
  getScrumBoard,
  setScrumBoard,
  type ScrumBoardSetting,
} from "@/lib/db/repos/jira-settings";

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      scrumBoard: getScrumBoard(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load Jira settings: ${message}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as {
      scrumBoard?: Partial<ScrumBoardSetting> | null;
    };

    if (body.scrumBoard === null) {
      // Clear by writing empty invalid — prefer explicit clear via omit.
      // Keep API simple: require a valid board object to save.
      return NextResponse.json(
        { error: "scrumBoard is required" },
        { status: 400 }
      );
    }

    const boardId = Number(body.scrumBoard?.boardId);
    if (!Number.isFinite(boardId) || boardId <= 0) {
      return NextResponse.json(
        { error: "Invalid boardId" },
        { status: 400 }
      );
    }

    const saved = setScrumBoard({
      boardId,
      boardName: String(body.scrumBoard?.boardName || ""),
      boardType: "scrum",
    });

    return NextResponse.json({ success: true, scrumBoard: saved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save Jira settings: ${message}` },
      { status: 500 }
    );
  }
}
