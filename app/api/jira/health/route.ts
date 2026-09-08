import { NextResponse } from "next/server";
import {
  getJiraClient,
  getJiraPublicEnvMeta,
  isJiraEnvConfigured,
  JiraEnvError,
} from "@/lib/jira";

async function safeJsonFetch(url: string, headers: Record<string, string>) {
  try {
    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: res.ok, status: res.status, data, errorText: res.ok ? undefined : text };
  } catch (err: unknown) {
    return {
      ok: false,
      status: 0,
      data: null,
      errorText: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET() {
  const meta = getJiraPublicEnvMeta();
  const checkedAt = new Date().toISOString();

  if (!isJiraEnvConfigured() || !meta.projectKey) {
    return NextResponse.json({
      success: false,
      connected: false,
      checkedAt,
      ...meta,
      configured: false,
      error:
        meta.missing.length > 0
          ? `Missing env: ${meta.missing.join(", ")}`
          : "Jira is not fully configured in environment.",
    });
  }

  try {
    const { jiraUrl, headers, projectKey, config, creds } = getJiraClient();

    const myselfRes = await safeJsonFetch(`${jiraUrl}/rest/api/2/myself`, headers);
    if (!myselfRes.ok) {
      return NextResponse.json({
        success: false,
        connected: false,
        configured: true,
        checkedAt,
        url: jiraUrl,
        projectKey,
        authType: creds.authType,
        config,
        error: `Authentication failed (${myselfRes.status}): ${myselfRes.errorText || "unknown"}`,
      });
    }

    const myself = myselfRes.data as Record<string, any>;

    const [
      projectRes,
      componentsRes,
      versionsRes,
      usersRes,
      serverInfoRes,
      statusesRes,
      epicsRes,
      boardsRes,
    ] = await Promise.all([
      safeJsonFetch(
        `${jiraUrl}/rest/api/2/project/${encodeURIComponent(projectKey)}`,
        headers
      ),
      safeJsonFetch(
        `${jiraUrl}/rest/api/2/project/${encodeURIComponent(projectKey)}/components`,
        headers
      ),
      safeJsonFetch(
        `${jiraUrl}/rest/api/2/project/${encodeURIComponent(projectKey)}/versions`,
        headers
      ),
      safeJsonFetch(
        `${jiraUrl}/rest/api/2/user/assignable/search?project=${encodeURIComponent(projectKey)}&maxResults=100`,
        headers
      ),
      safeJsonFetch(`${jiraUrl}/rest/api/2/serverInfo`, headers),
      safeJsonFetch(`${jiraUrl}/rest/api/2/status`, headers),
      safeJsonFetch(
        `${jiraUrl}/rest/api/2/search?jql=${encodeURIComponent(
          `project = "${projectKey}" AND issuetype = Epic`
        )}&maxResults=50&fields=summary,key,status,components`,
        headers
      ),
      safeJsonFetch(
        `${jiraUrl}/rest/agile/1.0/board?projectKeyOrId=${encodeURIComponent(projectKey)}`,
        headers
      ),
    ]);

    const project = projectRes.ok ? (projectRes.data as Record<string, any>) : null;
    const components = componentsRes.ok
      ? ((componentsRes.data as any[]) || []).map((c) => ({
          id: String(c.id),
          name: c.name,
          description: c.description || "",
        }))
      : [];
    const versions = versionsRes.ok
      ? ((versionsRes.data as any[]) || []).map((v) => ({
          id: String(v.id),
          name: v.name,
          released: !!v.released,
          archived: !!v.archived,
          startDate: v.startDate,
          releaseDate: v.releaseDate,
        }))
      : [];
    const users = usersRes.ok
      ? ((usersRes.data as any[]) || []).map((u) => ({
          name: u.name,
          displayName: u.displayName,
          emailAddress: u.emailAddress,
          active: u.active,
        }))
      : [];
    const epics = epicsRes.ok
      ? (((epicsRes.data as any)?.issues as any[]) || []).map((issue) => ({
          key: issue.key,
          summary: issue.fields?.summary || issue.key,
          status: issue.fields?.status?.name,
          components: (issue.fields?.components || []).map((c: any) => c.name),
        }))
      : [];

    const boards = boardsRes.ok
      ? (((boardsRes.data as any)?.values as any[]) || []).map((b) => ({
          id: b.id,
          name: b.name,
          type: b.type,
        }))
      : [];

    const scrumBoards = boards.filter((b) => b.type === "scrum");
    const sprints: Array<{
      id: number;
      name: string;
      state: string;
      boardName?: string;
    }> = [];
    const seen = new Set<number>();
    for (const board of scrumBoards.slice(0, 5)) {
      const sprintRes = await safeJsonFetch(
        `${jiraUrl}/rest/agile/1.0/board/${board.id}/sprint?state=active,future`,
        headers
      );
      if (!sprintRes.ok) continue;
      for (const s of ((sprintRes.data as any)?.values as any[]) || []) {
        if (seen.has(s.id)) continue;
        seen.add(s.id);
        sprints.push({
          id: s.id,
          name: s.name,
          state: s.state,
          boardName: board.name,
        });
      }
    }

    const statuses = statusesRes.ok
      ? ((statusesRes.data as any[]) || [])
          .slice(0, 40)
          .map((s) => ({ id: String(s.id), name: s.name, category: s.statusCategory?.name }))
      : [];

    const serverInfo = serverInfoRes.ok
      ? {
          version: (serverInfoRes.data as any)?.version,
          deploymentType: (serverInfoRes.data as any)?.deploymentType,
          serverTitle: (serverInfoRes.data as any)?.serverTitle,
          baseUrl: (serverInfoRes.data as any)?.baseUrl,
        }
      : null;

    return NextResponse.json({
      success: true,
      connected: true,
      configured: true,
      checkedAt,
      url: jiraUrl,
      projectKey,
      authType: creds.authType,
      config,
      user: {
        name: myself.name,
        displayName: myself.displayName,
        emailAddress: myself.emailAddress,
        active: myself.active,
        timeZone: myself.timeZone,
        locale: myself.locale,
        groups: myself.groups?.items?.map((g: any) => g.name) || [],
      },
      project: project
        ? {
            id: String(project.id),
            key: project.key,
            name: project.name,
            projectTypeKey: project.projectTypeKey,
            lead: project.lead?.displayName || project.lead?.name,
            description: project.description || "",
            simplified: project.simplified,
          }
        : null,
      components,
      versions,
      sprints,
      boards,
      users,
      epics,
      statuses,
      serverInfo,
      counts: {
        components: components.length,
        versions: versions.length,
        sprints: sprints.length,
        boards: boards.length,
        users: users.length,
        epics: epics.length,
        statuses: statuses.length,
      },
      warnings: [
        !projectRes.ok && `Project fetch failed: ${projectRes.errorText}`,
        !componentsRes.ok && `Components fetch failed: ${componentsRes.errorText}`,
        !versionsRes.ok && `Versions fetch failed: ${versionsRes.errorText}`,
        !usersRes.ok && `Users fetch failed: ${usersRes.errorText}`,
        !epicsRes.ok && `Epics fetch failed: ${epicsRes.errorText}`,
        !boardsRes.ok && `Boards fetch failed: ${boardsRes.errorText}`,
        !serverInfoRes.ok && `Server info fetch failed: ${serverInfoRes.errorText}`,
      ].filter(Boolean),
    });
  } catch (err: unknown) {
    const message =
      err instanceof JiraEnvError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown Jira health error";
    return NextResponse.json(
      {
        success: false,
        connected: false,
        checkedAt,
        ...meta,
        configured: isJiraEnvConfigured(),
        error: message,
      },
      { status: err instanceof JiraEnvError ? 503 : 500 }
    );
  }
}
