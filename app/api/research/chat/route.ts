import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  type UIMessage,
} from "ai";
import { createAgentTools } from "@/lib/ai/tools";
import { createJiraScoutTools } from "@/lib/ai/jira-tools";
import {
  getSdkGenerationOptions,
  getSdkLanguageModel,
} from "@/lib/ai/sdk-model";
import { serializeKnowledgeCitations } from "@/lib/knowledge/citations";
import { formatHitsForPrompt, searchKnowledge } from "@/lib/knowledge/search";

export const maxDuration = 120;

const RESEARCH_SYSTEM = `You are a product research assistant for a Jira workspace app.
Answer in fluent Persian unless the user writes in English.
Use searchKnowledge for internal product memory before guessing.
Use webSearch for public/current information when needed.
Use jiraSearchJql / getJiraIssue (read-only) when the user asks about tickets, backlog, or duplicates.
Cite sources briefly (knowledge titles, issue keys, or URLs).
When the user shares durable product facts, decisions, glossary, or "remember this", call saveToKnowledge with a clear title.
Keep answers concise and actionable.`;

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "user") continue;
    const text = (m.parts || [])
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("")
      .trim();
    if (text) return text;
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const messages = (body?.messages || []) as UIMessage[];
    const provider = body?.provider as string | undefined;
    const model = body?.model as string | undefined;

    const { model: languageModel, provider: resolvedProvider } =
      getSdkLanguageModel(provider, model);
    const baseTools = createAgentTools({ provider: resolvedProvider });
    const jiraTools = createJiraScoutTools();
    const tools = { ...baseTools, ...jiraTools };
    const generation = getSdkGenerationOptions();

    let knowledgeContext = "(no knowledge hits)";
    let knowledgeCitations = serializeKnowledgeCitations([]);
    try {
      const q = lastUserText(messages);
      if (q) {
        const hits = await searchKnowledge(q, {
          k: 6,
          provider: resolvedProvider,
        });
        knowledgeContext = formatHitsForPrompt(hits);
        knowledgeCitations = serializeKnowledgeCitations(hits);
      }
    } catch {
      knowledgeContext = "(knowledge search unavailable)";
    }

    const result = streamText({
      model: languageModel,
      system: `${RESEARCH_SYSTEM}

Relevant product knowledge:
${knowledgeContext}`,
      messages: await convertToModelMessages(messages, {
        ignoreIncompleteToolCalls: true,
      }),
      tools,
      stopWhen: stepCountIs(8),
      ...generation,
    });

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        if (knowledgeCitations.length) {
          writer.write({
            type: "data-knowledge",
            data: knowledgeCitations,
          } as any);
        }
        writer.merge(
          result.toUIMessageStream({
            messageMetadata: ({ part }) => {
              if (part.type === "start" || part.type === "finish") {
                return { knowledgeCitations };
              }
              return undefined;
            },
          })
        );
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Research chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
