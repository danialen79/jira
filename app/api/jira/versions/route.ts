import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";
import {
  buildVersionName,
  isValidProductVersion,
  isValidVersionProduct,
  normalizeVersionProduct,
} from "@/lib/roadmap";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function mapVersion(v: Record<string, unknown>) {
  return {
    id: String(v.id),
    name: v.name as string,
    released: !!v.released,
    archived: !!v.archived,
    overdue: !!v.overdue,
    startDate: v.startDate as string | undefined,
    releaseDate: v.releaseDate as string | undefined,
    description: v.description as string | undefined,
  };
}

export async function GET() {
  try {
    const { jiraUrl, headers, projectKey } = getJiraClient();

    const response = await fetch(
      `${jiraUrl}/rest/api/2/project/${projectKey}/versions`,
      {
        method: "GET",
        headers,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        {
          error: `Failed to fetch versions (${response.status}): ${text || response.statusText}`,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const versions = (data || []).map((v: Record<string, unknown>) =>
      mapVersion(v)
    );

    return NextResponse.json({ success: true, versions, projectKey });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Versions Fetch Error:", err);
    return NextResponse.json(
      { error: `Failed to fetch versions: ${message}` },
      { status: 500 }
    );
  }
}

type CreateVersionBody = {
  startDate?: string;
  releaseDate?: string;
  product?: string;
  version?: string;
  name?: string;
  description?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateVersionBody;
    const startDate =
      typeof body.startDate === "string" ? body.startDate.trim() : "";
    const releaseDate =
      typeof body.releaseDate === "string" ? body.releaseDate.trim() : "";
    const product = normalizeVersionProduct(
      typeof body.product === "string" ? body.product : ""
    );
    const version =
      typeof body.version === "string" ? body.version.trim() : "";

    if (!DATE_RE.test(startDate)) {
      return NextResponse.json(
        { error: "startDate must be YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (!DATE_RE.test(releaseDate)) {
      return NextResponse.json(
        { error: "releaseDate must be YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (startDate > releaseDate) {
      return NextResponse.json(
        { error: "startDate must be on or before releaseDate." },
        { status: 400 }
      );
    }
    if (!isValidVersionProduct(product)) {
      return NextResponse.json(
        {
          error:
            "product must start with a letter and use only letters/digits (e.g. Club).",
        },
        { status: 400 }
      );
    }
    if (!isValidProductVersion(version)) {
      return NextResponse.json(
        { error: "version must look like 2.6 or 1.0.1." },
        { status: 400 }
      );
    }

    const built = buildVersionName({ startDate, product, version });
    if (!built) {
      return NextResponse.json(
        { error: "Could not build version name." },
        { status: 400 }
      );
    }

    const explicitName =
      typeof body.name === "string" ? body.name.trim() : "";
    const name = explicitName || built;
    if (explicitName && explicitName !== built) {
      return NextResponse.json(
        {
          error: `name must match naming rule (${built}).`,
        },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, projectKey } = getJiraClient();

    const payload: Record<string, unknown> = {
      name,
      project: projectKey,
      startDate,
      releaseDate,
      released: false,
    };
    if (typeof body.description === "string" && body.description.trim()) {
      payload.description = body.description.trim();
    }

    const response = await fetch(`${jiraUrl}/rest/api/2/version`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: Record<string, unknown> | string | null = null;
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const errMsg =
        typeof data === "string"
          ? data
          : (data as { errorMessages?: string[] } | null)?.errorMessages?.[0] ||
            text ||
            response.statusText;
      return NextResponse.json(
        { error: `Failed to create version (${response.status}): ${errMsg}` },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      version: mapVersion(data as Record<string, unknown>),
    });
  } catch (err: unknown) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Jira Version Create Error:", err);
    return NextResponse.json(
      { error: `Failed to create version: ${message}` },
      { status: 500 }
    );
  }
}
