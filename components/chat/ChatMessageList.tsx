"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { BookMarked } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { EvidenceChips } from "@/components/chat/EvidenceChips";
import {
  extractKnowledgeCitations,
  type KnowledgeCitation,
} from "@/lib/knowledge/citations";
import {
  extractEvidenceChips,
} from "@/lib/ai/agents/activity";
import type { AskUserOutput } from "@/lib/ai/tools";

function messageText(message: UIMessage): string {
  if (!message.parts?.length) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function askUserSummaries(message: UIMessage): AskUserOutput["answers"] {
  const answers: AskUserOutput["answers"] = [];
  for (const part of message.parts || []) {
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
      output?: AskUserOutput;
    };
    if (p.state === "output-available" && p.output?.answers?.length) {
      answers.push(...p.output.answers);
    }
  }
  return answers;
}

function KnowledgeCitationsRow({
  citations,
}: {
  citations: KnowledgeCitation[];
}) {
  if (!citations.length) return null;
  return (
    <div className="flex max-w-[90%] min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
        <BookMarked className="size-3" aria-hidden="true" />
        دانش:
      </span>
      {citations.map((c) => (
        <Badge
          key={c.docId || c.title}
          variant="outline"
          className="max-w-48 truncate text-[10px] font-normal"
          title={`${c.title} · ${c.source} · ${c.score}`}
        >
          {c.title}
          <span className="text-muted-foreground ms-1">{c.source}</span>
        </Badge>
      ))}
    </div>
  );
}

function RunningConsultRows({ message }: { message: UIMessage }) {
  const rows: Array<{ id: string; label: string }> = [];
  for (const part of message.parts || []) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    const type = String(part.type);
    const p = part as { toolCallId?: string; state?: string };
    if (
      p.state !== "input-streaming" &&
      p.state !== "input-available" &&
      !(p.state === "output-available" && (part as { preliminary?: boolean }).preliminary)
    ) {
      continue;
    }
    const map: Record<string, string> = {
      "tool-consultKnowledge": "جستجو در دانش…",
      "tool-consultJira": "بررسی جیرا…",
      "tool-consultWeb": "جستجوی وب…",
      "tool-consultBrief": "خلاصه موازی…",
      "tool-proposeStories": "نوشتن استوری‌ها…",
    };
    if (!map[type]) continue;
    rows.push({
      id: p.toolCallId || `${type}-${rows.length}`,
      label: map[type]!,
    });
  }
  if (!rows.length) return null;
  return (
    <div className="text-muted-foreground flex max-w-[90%] flex-col gap-1 text-xs">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <Spinner className="size-3" />
          {r.label}
        </div>
      ))}
    </div>
  );
}

export function ChatMessageList({
  messages,
  status,
  className,
  jiraBrowseBase,
}: {
  messages: UIMessage[];
  status?: string;
  className?: string;
  jiraBrowseBase?: string | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    bottomRef.current?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
    });
  }, [messages, status]);

  const thinking =
    status === "submitted" ||
    (status === "streaming" &&
      messages.length > 0 &&
      messages[messages.length - 1]?.role === "assistant" &&
      !messageText(messages[messages.length - 1]!));

  return (
    <ScrollArea className={cn("min-h-0 flex-1 rounded-lg border", className)}>
      <div className="flex flex-col gap-3 p-3">
        {messages.length === 0 && (
          <p className="text-muted-foreground text-sm">هنوز پیامی نیست.</p>
        )}
        {messages.map((m) => {
          const text = messageText(m);
          const isUser = m.role === "user";
          const citations = isUser ? [] : extractKnowledgeCitations(m);
          const evidence = isUser ? [] : extractEvidenceChips(m);
          const quiz = isUser ? [] : askUserSummaries(m);
          const showBubble = !!text || (status === "streaming" && !isUser);
          return (
            <div
              key={m.id}
              className={cn(
                "flex min-w-0 flex-col gap-1",
                isUser ? "items-end" : "items-start"
              )}
            >
              <Badge variant="secondary" className="text-[10px]">
                {isUser ? "شما" : "AI"}
              </Badge>
              {showBubble ? (
                <div
                  className={cn(
                    "max-w-[90%] min-w-0 break-words rounded-2xl px-3 py-2 text-sm",
                    isUser
                      ? "bg-primary text-primary-foreground whitespace-pre-wrap"
                      : "bg-muted text-foreground"
                  )}
                >
                  {isUser ? (
                    text
                  ) : text ? (
                    <div className="[&_.markdown-body]:text-foreground [&_.markdown-body_p]:text-foreground [&_.markdown-body_li]:text-foreground">
                      <MarkdownPreview text={text} />
                    </div>
                  ) : (
                    "…"
                  )}
                </div>
              ) : null}
              {!isUser ? <RunningConsultRows message={m} /> : null}
              {quiz.length > 0 ? (
                <div className="bg-muted/60 flex max-w-[90%] min-w-0 flex-col gap-1.5 rounded-xl border px-3 py-2 text-xs">
                  <span className="text-muted-foreground">جواب پرسشنامه</span>
                  {quiz.map((a) => (
                    <div key={`${a.name}-${a.question}`} className="min-w-0">
                      <p className="text-muted-foreground truncate">
                        {a.question}
                      </p>
                      <p className="break-words font-medium">{a.answer}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {!isUser && <KnowledgeCitationsRow citations={citations} />}
              {!isUser && (
                <EvidenceChips
                  chips={evidence}
                  jiraBrowseBase={jiraBrowseBase}
                />
              )}
            </div>
          );
        })}
        {thinking && (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Spinner />
            در حال فکر…
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
