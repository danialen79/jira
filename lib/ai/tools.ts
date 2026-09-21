import { tool } from "ai";
import { z } from "zod";
import { ISSUE_DESCRIPTION_FIELD_HINT } from "@/lib/ai/issue-description-format";
import { getResolvedTavilyApiKey } from "@/lib/db/repos/ai";
import { ingestDocument, searchKnowledge } from "@/lib/knowledge/search";
import { sanitizeJiraText } from "@/lib/jira";

export const proposedIssueSchema = z.object({
  id: z
    .string()
    .describe(
      "Temporary id for this issue in the array, e.g. epic-1, story-1. Stories/Bugs must set epicReference to the parent Epic's id."
    ),
  summary: z
    .string()
    .describe("Imperative, specific Persian title; technical terms in English"),
  description: z.string().describe(ISSUE_DESCRIPTION_FIELD_HINT),
  issuetype: z.enum(["Story", "Epic", "Bug"]),
  epicReference: z
    .string()
    .optional()
    .describe(
      "For Story/Bug: the temporary id of the parent Epic in this same array (e.g. epic-1). Omit for Epics."
    ),
  suggestedPriority: z.string().optional(),
  suggestedComponent: z.string().optional(),
});

export type ProposedIssue = z.infer<typeof proposedIssueSchema>;

export function sanitizeProposedIssues(
  issues: ProposedIssue[]
): ProposedIssue[] {
  return issues.map((issue) => ({
    ...issue,
    summary: sanitizeJiraText(issue.summary),
    description: sanitizeJiraText(issue.description),
  }));
}

export const coverageSchema = z.object({
  goal: z.boolean(),
  user: z.boolean(),
  acceptance: z.boolean(),
  outOfScope: z.boolean(),
  dependencies: z.boolean(),
  risks: z.boolean(),
});

export const askUserChoiceSchema = z.object({
  value: z.string().describe("Stable id for the choice, e.g. ops"),
  label: z.string().describe("Short Persian label shown to the user"),
  description: z.string().optional().describe("Optional one-line hint"),
});

export const askUserQuestionSchema = z.object({
  name: z
    .string()
    .describe("Stable field id, e.g. goal or user-persona"),
  prompt: z.string().describe("The clarifying question in Persian"),
  description: z
    .string()
    .optional()
    .describe("Optional short helper under the prompt"),
  choices: z
    .array(askUserChoiceSchema)
    .min(2)
    .max(6)
    .describe("2–6 concrete answer options"),
  multiple: z
    .boolean()
    .optional()
    .describe("Allow selecting more than one choice"),
  required: z
    .boolean()
    .optional()
    .describe("Default true; set false to allow Skip"),
  allowFreeform: z
    .boolean()
    .optional()
    .describe("Show a free-text field next to choices (default true)"),
  coverageKey: z
    .enum([
      "goal",
      "user",
      "acceptance",
      "outOfScope",
      "dependencies",
      "risks",
    ])
    .optional()
    .describe("Which coverage dimension this question primarily fills"),
});

export const askUserInputSchema = z.object({
  questions: z
    .array(askUserQuestionSchema)
    .min(1)
    .max(3)
    .describe("1–3 clarifying questions for this turn"),
});

export type AskUserInput = z.infer<typeof askUserInputSchema>;
export type AskUserQuestion = z.infer<typeof askUserQuestionSchema>;
export type AskUserOutput = {
  answers: Array<{
    name: string;
    question: string;
    answer: string;
    coverageKey?: string;
  }>;
};

export function createAgentTools(opts?: {
  provider?: string;
  /** Client-side HITL tool for workshop interview questionnaires */
  includeAskUser?: boolean;
}) {
  const tools = {
    searchKnowledge: tool({
      description:
        "Search the product knowledge base with semantic + keyword retrieval. Use before answering product questions.",
      inputSchema: z.object({
        query: z.string().describe("Search query in Persian or English"),
        k: z.number().int().min(1).max(12).optional(),
      }),
      execute: async ({ query, k }) => {
        const hits = await searchKnowledge(query, {
          k: k ?? 6,
          provider: opts?.provider,
        });
        return {
          hits: hits.map((h) => ({
            title: h.title,
            source: h.source,
            score: Number(h.score.toFixed(4)),
            text: h.text,
            docId: h.docId,
          })),
        };
      },
    }),

    webSearch: tool({
      description:
        "Search the public web via Tavily for current facts, docs, or competitor info.",
      inputSchema: z.object({
        query: z.string(),
        maxResults: z.number().int().min(1).max(8).optional(),
      }),
      execute: async ({ query, maxResults }) => {
        const apiKey = getResolvedTavilyApiKey();
        if (!apiKey) {
          return {
            error: "Tavily API key is not configured in Settings",
            results: [] as Array<{
              title: string;
              url: string;
              content: string;
            }>,
          };
        }
        const res = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            query,
            max_results: maxResults ?? 5,
            search_depth: "basic",
            include_answer: false,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          return {
            error: `Tavily error ${res.status}: ${text.slice(0, 200)}`,
            results: [],
          };
        }
        const data = (await res.json()) as {
          results?: Array<{ title?: string; url?: string; content?: string }>;
        };
        return {
          results: (data.results || []).map((r) => ({
            title: r.title || "",
            url: r.url || "",
            content: (r.content || "").slice(0, 800),
          })),
        };
      },
    }),

    saveToKnowledge: tool({
      description:
        "Save a durable product note into the knowledge base (embeds as canonical; duplicates are skipped).",
      inputSchema: z.object({
        title: z.string(),
        text: z.string(),
        source: z.enum(["manual", "research", "workshop", "jira"]).optional(),
      }),
      execute: async ({ title, text, source }) => {
        const result = await ingestDocument({
          title,
          rawText: text,
          source: source || "research",
          provider: opts?.provider,
          layer: "canonical",
        });
        return {
          docId: result.doc.id,
          chunkCount: result.chunkCount,
          model: result.model,
          skipped: result.skipped,
        };
      },
    }),

    proposeStories: tool({
      description:
        "Propose final Jira epics/stories/bugs as structured JSON when the interview has enough coverage. Call only when ready to write. Every issue MUST have a unique id (epic-1, story-1, …). Stories and Bugs MUST set epicReference to the parent Epic's id from this same list. Descriptions MUST use Scrum plain-Persian structure (داستان کاربر + معیارهای پذیرش / bug repro / epic هدف کلی) with no markdown or Jira wiki.",
      inputSchema: z.object({
        issues: z.array(proposedIssueSchema).min(1),
        coverage: coverageSchema,
        notes: z.string().optional(),
      }),
      execute: async ({ issues, coverage, notes }) => {
        return {
          issues: sanitizeProposedIssues(issues),
          coverage,
          notes: notes || "",
        };
      },
    }),

    updateCoverage: tool({
      description:
        "Update which interview coverage dimensions are understood after user answers.",
      inputSchema: z.object({
        coverage: coverageSchema,
      }),
      execute: async ({ coverage }) => ({ coverage }),
    }),
  };

  if (opts?.includeAskUser) {
    return {
      ...tools,
      // No execute — client renders Questionnaire and calls addToolOutput.
      askUser: tool({
        description:
          "Ask the user clarifying questions as an interactive questionnaire with suggested choices. Prefer this over writing numbered questions as plain chat text. Use 1–3 questions per turn covering uncovered dimensions. Always include concrete choices; freeform is available on the client.",
        inputSchema: askUserInputSchema,
      }),
    };
  }

  return tools;
}

export type AgentTools = ReturnType<typeof createAgentTools>;
