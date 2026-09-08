import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type VersionUpdateBody = {
  versionId?: string;
  startDate?: string | null;
  releaseDate?: string | null;
  released?: boolean;
};

function normalizeDate(
  value: unknown
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!DATE_RE.test(trimmed)) return undefined;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VersionUpdateBody;
    const versionId =
      typeof body.versionId === "string" ? body.versionId.trim() : "";
    if (!versionId) {
      return NextResponse.json(
        { error: "Version ID is required." },
        { status: 400 }
      );
    }

    const updateData: Record<string, string | boolean | null> = {};

    if ("startDate" in body) {
      const startDate = normalizeDate(body.startDate);
      if (startDate === undefined) {
        return NextResponse.json(
          { error: "startDate must be YYYY-MM-DD or empty." },
          { status: 400 }
        );
      }
      updateData.startDate = startDate;
    }

    if ("releaseDate" in body) {
      const releaseDate = normalizeDate(body.releaseDate);
      if (releaseDate === undefined) {
        return NextResponse.json(
          { error: "releaseDate must be YYYY-MM-DD or empty." },
          { status: 400 }
        );
      }
      updateData.releaseDate = releaseDate;
    }

    if (typeof body.released === "boolean") {
      updateData.released = body.released;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
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
    return NextResponse.json({
      success: true,
      version: {
        id: String(data.id),
        name: data.name as string,
        released: !!data.released,
        archived: !!data.archived,
        overdue: !!data.overdue,
        startDate: data.startDate as string | undefined,
        releaseDate: data.releaseDate as string | undefined,
        description: data.description as string | undefined,
      },
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Version Update Error:", err);
    return NextResponse.json(
      { error: `Failed to update version: ${message}` },
      { status: 500 }
    );
  }
}
