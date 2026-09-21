import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import {
  buildInterviewSystemPrompt,
  createInterviewOrchestratorTools,
} from "@/lib/ai/agents/interview-orchestrator";
import {
  getSdkAgentRoleModel,
  getSdkGenerationOptions,
} from "@/lib/ai/sdk-model";
import {
  createInterviewSession,
  getInterviewSession,
  updateInterviewSession,
  type InterviewCoverage,
  type InterviewMessage,
} from "@/lib/db/repos/knowledge";
import { serializeKnowledgeCitations } from "@/lib/knowledge/citations";
import {
  formatHitsForPrompt,
  searchKnowledge,
  type KnowledgeHit,
} from "@/lib/knowledge/search";
import {
  forcedDelegatesForceWrite,
  parseForcedDelegates,
} from "@/lib/ai/agents/workshop-agents";

export const maxDuration = 180;

function coverageSummary(c: InterviewCoverage): string {
  const entries: Array<[keyof InterviewCoverage, string]> = [
    ["goal", "هدف"],
    ["user", "کاربر"],
    ["acceptance", "پذیرش"],
    ["outOfScope", "خارج از scope"],
    ["dependencies", "وابستگی"],
    ["risks", "ریسک"],
  ];
  return entries
    .map(([k, label]) => `${label}: ${c[k] ? "✓" : "—"}`)
    .join(" | ");
}

/** Persist askUser questionnaire answers into the text transcript. */
function askUserAnswersFromMessages(
  uiMessages: UIMessage[]
): InterviewMessage[] {
  const out: InterviewMessage[] = [];
  for (const msg of uiMessages) {
    for (const part of msg.parts || []) {
      if (
        !part ||
        typeof part !== "object" ||
        !("type" in part) ||
        part.type !== "tool-askUser"
      ) {
        continue;
      }
      const p = part as {
        state?: string;
        output?: {
          answers?: Array<{ question?: string; answer?: string }>;
        };
      };
      if (p.state !== "output-available" || !p.output?.answers?.length) continue;
      const lines = p.output.answers
        .map((a) => {
          const q = String(a.question || "").trim();
          const aText = String(a.answer || "").trim();
          if (!q && !aText) return "";
          return q ? `${q}\n→ ${aText || "(بدون جواب)"}` : aText;
        })
        .filter(Boolean);
      if (lines.length) {
        out.push({
          role: "user",
          content: `پاسخ پرسشنامه:\n${lines.join("\n\n")}`,
        });
      }
    }
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body?.action || "chat";
    const provider = body?.provider as string | undefined;
    const forcedDelegates = parseForcedDelegates(body?.forcedDelegates);
    const forceWrite =
      !!body?.forceWrite || forcedDelegatesForceWrite(forcedDelegates);
    const outputMode = String(body?.outputMode || "both");

    if (action === "create") {
      const draftText = String(body?.draftText || "").trim();
      const session = createInterviewSession(draftText);
      return Response.json({ session });
    }

    if (action === "get") {
      const id = String(body?.sessionId || "");
      const session = id ? getInterviewSession(id) : null;
      return Response.json({ session });
    }

    if (action === "latest") {
      const { getLatestOpenInterviewSession } = await import(
        "@/lib/db/repos/knowledge"
      );
      return Response.json({ session: getLatestOpenInterviewSession() });
    }

    const sessionId = String(body?.sessionId || "");
    let session = sessionId ? getInterviewSession(sessionId) : null;
    if (!session) {
      session = createInterviewSession(String(body?.draftText || ""));
    }

    const userText = String(body?.message || "").trim();
    const messages = (body?.messages || []) as UIMessage[];

    if (userText) {
      const nextMessages: InterviewMessage[] = [
        ...session.messages,
        { role: "user", content: userText },
      ];
      session =
        updateInterviewSession(session.id, {
          messages: nextMessages,
          draftText: body?.draftText ?? session.draftText,
        }) || session;
    } else if (typeof body?.draftText === "string") {
      session =
        updateInterviewSession(session.id, {
          draftText: body.draftText,
        }) || session;
    }

    const quizAnswers = askUserAnswersFromMessages(messages);
    if (quizAnswers.length) {
      const existing = new Set(
        session.messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
      );
      const fresh = quizAnswers.filter((m) => !existing.has(m.content));
      if (fresh.length) {
        session =
          updateInterviewSession(session.id, {
            messages: [...session.messages, ...fresh],
          }) || session;
      }
    }

    let knowledgeContext = "";
    let ragHits: KnowledgeHit[] = [];
    try {
      const seed = [session.draftText, userText].filter(Boolean).join("\n");
      if (seed.trim()) {
        ragHits = await searchKnowledge(seed, {
          k: 5,
          provider,
        });
        knowledgeContext = formatHitsForPrompt(ragHits);
      }
    } catch {
      knowledgeContext = "(knowledge search unavailable)";
    }

    const knowledgeCitations = serializeKnowledgeCitations(ragHits);

    const outputModeHint =
      outputMode === "epics"
        ? "Only Epics."
        : outputMode === "stories"
          ? "Only Stories."
          : outputMode === "bugs"
            ? "Only Bugs."
            : "Epics, Stories, and Bugs as appropriate.";

    const { model: languageModel, provider: resolvedProvider } =
      getSdkAgentRoleModel("orchestrator", provider);
    const { model: subagentModel } = getSdkAgentRoleModel(
      "subagent",
      resolvedProvider
    );

    const system = buildInterviewSystemPrompt({
      draftText: session.draftText,
      coverageSummary: coverageSummary(session.coverage),
      knowledgeContext,
      outputModeHint,
      forceWrite,
      forcedDelegates,
    });

    const { tools, stopWhen } = createInterviewOrchestratorTools({
      subagentModel,
      provider: resolvedProvider,
    });
    const generation = getSdkGenerationOptions();

    const uiMessages: UIMessage[] =
      messages.length > 0
        ? messages
        : ([
            {
              id: "seed",
              role: "user",
              parts: [
                {
                  type: "text",
                  text:
                    userText ||
                    (forceWrite
                      ? "کافی است؛ استوری‌ها را بنویس."
                      : session.draftText
                        ? `پیش‌نویس من:\n${session.draftText}\n\nسوالات روشن‌سازی بپرس.`
                        : "مصاحبه را شروع کن."),
                },
              ],
            },
          ] as UIMessage[]);

    const result = streamText({
      model: languageModel,
      system,
      messages: await convertToModelMessages(uiMessages, {
        ignoreIncompleteToolCalls: true,
      }),
      tools,
      stopWhen,
      ...generation,
      onFinish: async ({ text, steps }) => {
        const assistantText = text?.trim();
        let coverage = session!.coverage;
        let output: unknown = null;
        let status = session!.status;

        for (const step of steps || []) {
          for (const call of step.toolCalls || []) {
            const name = call.toolName;
            const resultPart = step.toolResults?.find(
              (r) => r.toolCallId === call.toolCallId
            ) as { output?: any } | undefined;
            const out = resultPart?.output;
            if (name === "updateCoverage" && out?.coverage) {
              coverage = out.coverage;
            }
            if (name === "proposeStories" && out?.issues) {
              output = out;
              status = "ready";
              if (out.coverage) coverage = out.coverage;
            }
          }
        }

        if (forceWrite && output) status = "ready";

        const msgs: InterviewMessage[] = [...session!.messages];
        if (assistantText) {
          msgs.push({ role: "assistant", content: assistantText });
        }

        const shouldIngestKnowledge =
          status === "ready" ||
          (forceWrite && (msgs.length >= 2 || !!session!.draftText.trim()));

        updateInterviewSession(session!.id, {
          messages: msgs,
          coverage,
          output,
          status,
        });

        if (shouldIngestKnowledge) {
          try {
            const { ingestWorkshopSession } = await import(
              "@/lib/knowledge/conversation-ingest"
            );
            await ingestWorkshopSession({
              sessionId: session!.id,
              provider: resolvedProvider,
              force: forceWrite && status !== "ready",
            });
          } catch (e) {
            console.error("workshop knowledge ingest failed", e);
          }
        }
      },
    });

    const stream = createUIMessageStream({
      execute: ({ writer }) => {
        if (knowledgeCitations.length) {
          writer.write({
            type: "data-knowledge",
            id: `rag-${session!.id}`,
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

    return createUIMessageStreamResponse({
      stream,
      headers: {
        "X-Interview-Session-Id": session.id,
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message || "Interview failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
