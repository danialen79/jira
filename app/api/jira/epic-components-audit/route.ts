import { NextResponse } from "next/server";
import { getJiraClient, JiraEnvError } from "@/lib/jira";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      startAt = 0,
      maxResults = 10,
      onlyWithComponents = true,
      onlyMissing = true,
    } = body || {};

    const { jiraUrl, headers, projectKey, config } = getJiraClient();
    const epicLinkField = config.epicLinkField || "customfield_10014";

    const projKey = projectKey;
    const epicJqlCandidates: string[] = [];
    if (onlyWithComponents) {
      epicJqlCandidates.push(
        `project = '${projKey}' AND issuetype = 'Epic' AND component IS NOT EMPTY ORDER BY key DESC`
      );
      epicJqlCandidates.push(
        `project = '${projKey}' AND issuetype = 'Epic' AND component is not EMPTY ORDER BY key DESC`
      );
    }
    epicJqlCandidates.push(
      `project = '${projKey}' AND issuetype = 'Epic' ORDER BY key DESC`
    );

    let epicSearchRes: Response | null = null;
    let lastErrText = "";

    for (const jqlCandidate of epicJqlCandidates) {
      console.log(`[Jira Server Audit] Fetching Epics JQL: ${jqlCandidate}`);
      try {
        const resCandidate = await fetch(`${jiraUrl}/rest/api/2/search`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jql: jqlCandidate,
            startAt: 0,
            maxResults: 300,
            fields: ["summary", "components", "status", "priority", "issuetype"],
          }),
        });

        if (resCandidate.ok) {
          epicSearchRes = resCandidate;
          break;
        } else {
          lastErrText = await resCandidate.text();
          console.warn(
            `[Jira Server Audit] JQL failed (${resCandidate.status}): ${lastErrText}. Trying fallback candidate...`
          );
        }
      } catch (e: any) {
        lastErrText = e.message;
      }
    }

    if (!epicSearchRes) {
      return NextResponse.json(
        {
          error: `Jira returned error when fetching Epics: ${lastErrText}`,
        },
        { status: 400 }
      );
    }

    const epicData = await epicSearchRes.json();
    const fetchedEpics = epicData.issues || [];

    if (fetchedEpics.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        startAt: Number(startAt) || 0,
        maxResults: Number(maxResults) || 10,
        epics: [],
      });
    }

    const candidateEpics = fetchedEpics.filter((issue: any) => {
      if (!onlyWithComponents) return true;
      const comps = (issue.fields?.components || []).map((c: any) => c.name).filter(Boolean);
      return comps.length > 0;
    });

    if (candidateEpics.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        startAt: Number(startAt) || 0,
        maxResults: Number(maxResults) || 10,
        epics: [],
      });
    }

    const epicMap: Record<string, any> = {};
    const epicKeys: string[] = [];

    candidateEpics.forEach((issue: any) => {
      const key = issue.key;
      epicKeys.push(key);
      const comps = (issue.fields?.components || []).map((c: any) => c.name).filter(Boolean);
      epicMap[key] = {
        key,
        summary: issue.fields?.summary || key,
        components: comps,
        status: issue.fields?.status?.name || "",
        childIssues: [],
      };
    });

    let childIssuesRaw: any[] = [];
    const chunkSize = 50;

    for (let i = 0; i < epicKeys.length; i += chunkSize) {
      const chunkKeys = epicKeys.slice(i, i + chunkSize);
      const formattedEpicKeysStr = chunkKeys.map((k) => `"${k}"`).join(",");
      let cfNumber = "";
      if (epicLinkField.startsWith("customfield_")) {
        cfNumber = epicLinkField.replace("customfield_", "");
      }

      const jqlCandidates = [
        cfNumber
          ? `project = '${projKey}' AND (cf[${cfNumber}] in (${formattedEpicKeysStr}) OR "Epic Link" in (${formattedEpicKeysStr}) OR parent in (${formattedEpicKeysStr}))`
          : null,
        `project = '${projKey}' AND ("${epicLinkField}" in (${formattedEpicKeysStr}) OR "Epic Link" in (${formattedEpicKeysStr}) OR parent in (${formattedEpicKeysStr}))`,
        `project = '${projKey}' AND ("Epic Link" in (${formattedEpicKeysStr}) OR parent in (${formattedEpicKeysStr}))`,
        `project = '${projKey}' AND parent in (${formattedEpicKeysStr})`,
      ].filter(Boolean) as string[];

      for (const jqlCandidate of jqlCandidates) {
        try {
          const childRes = await fetch(`${jiraUrl}/rest/api/2/search`, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              jql: jqlCandidate,
              maxResults: 500,
              fields: [
                "summary",
                "components",
                "status",
                "priority",
                "issuetype",
                epicLinkField,
                "customfield_10014",
                "parent",
                "epic",
              ],
            }),
          });

          if (childRes.ok) {
            const childData = await childRes.json();
            childIssuesRaw.push(...(childData.issues || []));
            break;
          }
        } catch (e) {
          console.warn(`JQL candidate failed: ${jqlCandidate}`, e);
        }
      }
    }

    childIssuesRaw.forEach((issue: any) => {
      const fields = issue.fields || {};
      const key = issue.key;

      let parentKey: string | null = null;
      if (fields.epic?.key && epicMap[fields.epic.key]) {
        parentKey = fields.epic.key;
      } else if (fields.parent?.key && epicMap[fields.parent.key]) {
        parentKey = fields.parent.key;
      } else if (fields[epicLinkField] && epicMap[fields[epicLinkField]]) {
        parentKey = fields[epicLinkField];
      } else if (fields.customfield_10014 && epicMap[fields.customfield_10014]) {
        parentKey = fields.customfield_10014;
      } else {
        for (const ek of epicKeys) {
          if (JSON.stringify(fields).includes(ek)) {
            parentKey = ek;
            break;
          }
        }
      }

      if (parentKey && epicMap[parentKey]) {
        const childComps = (fields.components || []).map((c: any) => c.name).filter(Boolean);
        const epicComps = epicMap[parentKey].components;

        const missingComponents = epicComps.filter(
          (ec: string) =>
            !childComps.some(
              (cc: string) => cc.toLowerCase().trim() === ec.toLowerCase().trim()
            )
        );

        epicMap[parentKey].childIssues.push({
          key,
          summary: fields.summary || "",
          issuetype: fields.issuetype?.name || "Story",
          status: fields.status?.name || "Todo",
          components: childComps,
          missingComponents,
        });
      }
    });

    const allEpics = Object.values(epicMap);

    const qualifiedEpics = allEpics.filter((epic: any) => {
      if (!epic.childIssues || epic.childIssues.length === 0) return false;
      if (onlyMissing) {
        return epic.childIssues.some(
          (child: any) =>
            child.missingComponents.length > 0 || child.components.length === 0
        );
      }
      return true;
    });

    const startAtNum = Number(startAt) || 0;
    const maxResultsNum = Number(maxResults) || 10;
    const totalQualified = qualifiedEpics.length;
    const pagedEpics = qualifiedEpics.slice(startAtNum, startAtNum + maxResultsNum);

    return NextResponse.json({
      success: true,
      total: totalQualified,
      startAt: startAtNum,
      maxResults: maxResultsNum,
      epics: pagedEpics,
    });
  } catch (err: any) {
    if (err instanceof JiraEnvError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("Epic Components Audit Error:", err);
    return NextResponse.json({ error: `Audit failed: ${err.message}` }, { status: 500 });
  }
}
