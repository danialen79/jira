import { tool } from "ai";
import { z } from "zod";
import {
  getJiraIssue,
  jiraSearchJql,
  tryGetJiraClient,
} from "@/lib/jira-search";

/** Read-only Jira tools for the Jira Scout subagent (and research opt-in). */
export function createJiraScoutTools() {
  return {
    jiraSearchJql: tool({
      description:
        "Search Jira with JQL (read-only). Prefer project = current project. Max 50 results.",
      inputSchema: z.object({
        jql: z.string().describe("Valid Jira JQL"),
        maxResults: z.number().int().min(1).max(50).optional(),
        startAt: z.number().int().min(0).optional(),
      }),
      execute: async ({ jql, maxResults, startAt }) => {
        const gate = tryGetJiraClient();
        if (!gate.ok) {
          return { error: gate.error, issues: [], total: 0, jql };
        }
        try {
          const result = await jiraSearchJql({
            jql,
            maxResults,
            startAt,
            client: gate.client,
          });
          return {
            projectKey: result.projectKey,
            jql: result.jql,
            total: result.total,
            issues: result.issues,
          };
        } catch (e) {
          return {
            error: e instanceof Error ? e.message : "Jira search failed",
            issues: [],
            total: 0,
            jql,
          };
        }
      },
    }),

    getJiraIssue: tool({
      description: "Fetch one Jira issue by key (read-only). Description is truncated.",
      inputSchema: z.object({
        issueKey: z.string().describe("e.g. PROJ-123"),
      }),
      execute: async ({ issueKey }) => {
        const gate = tryGetJiraClient();
        if (!gate.ok) {
          return { error: gate.error };
        }
        try {
          const issue = await getJiraIssue({
            issueKey,
            client: gate.client,
          });
          return { issue };
        } catch (e) {
          return {
            error: e instanceof Error ? e.message : "Jira get issue failed",
          };
        }
      },
    }),
  };
}

export type JiraScoutTools = ReturnType<typeof createJiraScoutTools>;
