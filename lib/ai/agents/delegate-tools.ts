import { tool } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { createKnowledgeLibrarian } from "@/lib/ai/agents/knowledge-librarian";
import { createJiraScout } from "@/lib/ai/agents/jira-scout";
import { createWebScout } from "@/lib/ai/agents/web-scout";
import { packBriefForTool, parseResearchBrief } from "@/lib/ai/agents/parse-brief";
import {
  briefToModelText,
  emptyBrief,
  type ResearchBrief,
} from "@/lib/ai/evidence";

export type DelegateAgentOpts = {
  model: LanguageModel;
  provider?: string;
};

async function runLibrarian(
  opts: DelegateAgentOpts,
  task: string,
  abortSignal?: AbortSignal
) {
  const agent = createKnowledgeLibrarian({
    model: opts.model,
    provider: opts.provider,
  });
  const result = await agent.generate({ prompt: task, abortSignal });
  return packBriefForTool(
    parseResearchBrief(result.text, "دانش: نتیجه‌ای استخراج نشد")
  );
}

async function runJiraScout(
  opts: DelegateAgentOpts,
  task: string,
  abortSignal?: AbortSignal
) {
  const agent = createJiraScout({ model: opts.model });
  const result = await agent.generate({ prompt: task, abortSignal });
  return packBriefForTool(
    parseResearchBrief(result.text, "جیرا: نتیجه‌ای استخراج نشد")
  );
}

async function runWebScout(
  opts: DelegateAgentOpts,
  task: string,
  abortSignal?: AbortSignal
) {
  const agent = createWebScout({
    model: opts.model,
    provider: opts.provider,
  });
  const result = await agent.generate({ prompt: task, abortSignal });
  return packBriefForTool(
    parseResearchBrief(result.text, "وب: نتیجه‌ای استخراج نشد")
  );
}

function mergeBriefs(parts: ResearchBrief[], summary: string): ResearchBrief {
  const cards = parts.flatMap((p) => p.cards).slice(0, 8);
  const summaries = parts.map((p) => p.summary).filter(Boolean);
  return {
    summary: [summary, ...summaries].filter(Boolean).join(" | ").slice(0, 1500),
    cards,
  };
}

export function createDelegateTools(opts: DelegateAgentOpts) {
  return {
    consultKnowledge: tool({
      description:
        "Delegate to Knowledge Librarian. Use for product memory, prior workshops, glossary before inventing facts.",
      inputSchema: z.object({
        question: z.string().describe("What to look up in knowledge"),
        why: z.string().optional().describe("Why this matters for the interview"),
      }),
      execute: async ({ question, why }, { abortSignal }) => {
        const task = why
          ? `سوال: ${question}\nدلیل: ${why}`
          : question;
        try {
          return await runLibrarian(opts, task, abortSignal);
        } catch (e) {
          return packBriefForTool(
            emptyBrief(
              "دانش در دسترس نیست",
              e instanceof Error ? e.message : "error"
            )
          );
        }
      },
    }),

    consultJira: tool({
      description:
        "Delegate to Jira Scout (read-only JQL). Use for dependencies, risks, duplicates (intent=similar), components.",
      inputSchema: z.object({
        intent: z
          .enum(["similar", "dependencies", "risks", "components", "custom"])
          .describe("Scout intent; similar required before proposeStories"),
        hints: z
          .string()
          .describe("Keywords, component names, or free-text context for JQL"),
        why: z.string().optional(),
      }),
      execute: async ({ intent, hints, why }, { abortSignal }) => {
        const task = [
          `Intent: ${intent}`,
          `Hints: ${hints}`,
          why ? `Why: ${why}` : "",
          intent === "similar"
            ? "Focus on duplicate/overlap; set collide on cards to reuse|extend|net-new."
            : "",
        ]
          .filter(Boolean)
          .join("\n");
        try {
          return await runJiraScout(opts, task, abortSignal);
        } catch (e) {
          return packBriefForTool(
            emptyBrief(
              "جیرا در دسترس نیست",
              e instanceof Error ? e.message : "error"
            )
          );
        }
      },
    }),

    consultWeb: tool({
      description:
        "Delegate to Web Scout (Tavily). Only when knowledge + Jira left open gaps.",
      inputSchema: z.object({
        question: z.string(),
        why: z.string().optional(),
      }),
      execute: async ({ question, why }, { abortSignal }) => {
        const task = why
          ? `سوال: ${question}\nدلیل: ${why}\nفقط اگر اطلاعات عمومی لازم است.`
          : question;
        try {
          return await runWebScout(opts, task, abortSignal);
        } catch (e) {
          return packBriefForTool(
            emptyBrief(
              "وب در دسترس نیست",
              e instanceof Error ? e.message : "error"
            )
          );
        }
      },
    }),

    consultBrief: tool({
      description:
        "Parallel brief: knowledge + jira together. Optional web if includeWeb. Prefer on first turn after draft (ghost interview).",
      inputSchema: z.object({
        topic: z.string().describe("Draft or topic to research"),
        includeWeb: z
          .boolean()
          .optional()
          .describe("Also run web scout (default false)"),
      }),
      execute: async ({ topic, includeWeb }, { abortSignal }) => {
        try {
          const jobs: Promise<ReturnType<typeof packBriefForTool>>[] = [
            runLibrarian(
              opts,
              `موضوع/پیش‌نویس:\n${topic}\nیافته‌های مرتبط برای مصاحبه محصول.`,
              abortSignal
            ),
            runJiraScout(
              opts,
              `Intent: similar\nHints: ${topic.slice(0, 400)}\nAlso note open dependencies if visible.`,
              abortSignal
            ),
          ];
          if (includeWeb) {
            jobs.push(
              runWebScout(
                opts,
                `موضوع: ${topic}\nفقط حقایق عمومی مفید برای شفاف‌سازی محصول.`,
                abortSignal
              )
            );
          }
          const results = await Promise.all(jobs);
          const merged = mergeBriefs(
            results.map((r) => r.brief),
            "خلاصه موازی دانش و جیرا"
          );
          return {
            brief: merged,
            modelText: briefToModelText(merged),
            parts: results.map((r) => r.brief),
          };
        } catch (e) {
          return packBriefForTool(
            emptyBrief(
              "consultBrief ناموفق",
              e instanceof Error ? e.message : "error"
            )
          );
        }
      },
    }),
  };
}

export type DelegateTools = ReturnType<typeof createDelegateTools>;
