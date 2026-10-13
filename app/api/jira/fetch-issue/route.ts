import { NextResponse } from "next/server";
import { parseJiraDueDate } from "@/lib/due-date";
import { parseScore } from "@/lib/impact-effort";
import { parseJiraSprintField } from "@/lib/jira-sprint";
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
    const impactField = config.impactFieldId;
    const effortField = config.effortFieldId;
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
      "duedate",
      "timespent",
      "timeestimate",
      "timeoriginalestimate",
      epicLinkField,
      sprintField,
      ...(impactField ? [impactField] : []),
      ...(effortField ? [effortField] : []),
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

    const { selectedSprint, sprintName } = parseJiraSprintField(
      f[sprintField]
    );

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
        dueDate: parseJiraDueDate(f.duedate),
        impact: impactField ? parseScore(f[impactField]) : null,
        effort: effortField ? parseScore(f[effortField]) : null,
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
