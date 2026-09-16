import { NextResponse } from "next/server";
import { parseLensFromLabels } from "@/lib/lens";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const { issueKey } = await req.json();
    if (!issueKey) {
      return NextResponse.json(
        { error: "issueKey is required." },
        { status: 400 }
      );
    }

    const { jiraUrl, headers, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";
    const sprintField = config.sprintFieldId || "customfield_10010";
    const fieldList = [
      "summary",
      "description",
      "issuetype",
      "priority",
      "components",
      "assignee",
      "status",
      "labels",
      "fixVersions",
      "parent",
      "created",
      "updated",
      "timespent",
      "timeestimate",
      "timeoriginalestimate",
      epicLinkField,
      sprintField,
    ].join(",");

    const fetchUrl = `${jiraUrl}/rest/api/2/issue/${encodeURIComponent(String(issueKey).trim())}?fields=${encodeURIComponent(fieldList)}`;

    console.log(
      `[Jira Refiner Server] Fetching issue ${issueKey} from ${fetchUrl}`
    );
    const response = await fetch(fetchUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira returned status ${response.status}: ${text}`);
    }

    const data = await response.json();
    const f = data.fields || {};
    const labels: string[] = Array.isArray(f.labels) ? f.labels : [];
    const epicLink = f[epicLinkField];
    const resolvedEpicKey =
      (typeof epicLink === "string" ? epicLink : epicLink?.key) || undefined;

    const sprintRaw = f[sprintField];
    let selectedSprint: string | undefined;
    let sprintName: string | undefined;
    if (typeof sprintRaw === "number") {
      selectedSprint = String(sprintRaw);
    } else if (typeof sprintRaw === "string") {
      const idMatch = sprintRaw.match(/id=(\d+)/);
      selectedSprint = idMatch?.[1] || undefined;
      const nameMatch = sprintRaw.match(/name=([^,\]]+)/);
      sprintName = nameMatch?.[1]?.trim() || undefined;
    } else if (Array.isArray(sprintRaw) && sprintRaw.length > 0) {
      const active =
        sprintRaw.find((s: { state?: string }) => s.state === "active") ||
        sprintRaw[sprintRaw.length - 1];
      if (active?.id != null) selectedSprint = String(active.id);
      if (active?.name) sprintName = String(active.name);
    } else if (sprintRaw && typeof sprintRaw === "object" && sprintRaw.id) {
      selectedSprint = String(sprintRaw.id);
      if (sprintRaw.name) sprintName = String(sprintRaw.name);
    }

    const fixVersions = Array.isArray(f.fixVersions) ? f.fixVersions : [];
    const selectedRelease =
      fixVersions[0]?.id != null ? String(fixVersions[0].id) : undefined;

    const components = Array.isArray(f.components) ? f.components : [];

    return NextResponse.json({
      success: true,
      issue: {
        key: data.key,
        summary: f.summary || "",
        description: f.description || "",
        issuetype: f.issuetype?.name || "Story",
        priority: f.priority?.name || "Medium",
        component: components[0]?.name || "",
        components: components.map((c: { name?: string }) => c.name || ""),
        assignee: f.assignee?.name || "",
        assigneeDisplayName: f.assignee?.displayName || "",
        status: f.status?.name || "",
        statusCategoryKey: f.status?.statusCategory?.key || undefined,
        labels,
        selectedLens: parseLensFromLabels(labels),
        epicKey: resolvedEpicKey,
        parentKey: f.parent?.key || undefined,
        parentSummary: f.parent?.fields?.summary || undefined,
        selectedRelease,
        selectedSprint,
        sprintName,
        fixVersionIds: fixVersions.map((v: { id: string }) => String(v.id)),
        fixVersionNames: fixVersions.map(
          (v: { name: string }) => v.name as string
        ),
        created: f.created || undefined,
        updated: f.updated || undefined,
        timespent:
          typeof f.timespent === "number" ? f.timespent : undefined,
        timeestimate:
          typeof f.timeestimate === "number" ? f.timeestimate : undefined,
        timeoriginalestimate:
          typeof f.timeoriginalestimate === "number"
            ? f.timeoriginalestimate
            : undefined,
      },
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Jira Fetch Issue Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
