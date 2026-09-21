"use client";

import type { UIMessage } from "ai";
import {
  BookMarked,
  Bot,
  Check,
  Globe,
  PenLine,
  Ticket,
  User,
  X,
} from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { EvidenceChips } from "@/components/chat/EvidenceChips";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Bubble,
  BubbleContent,
} from "@/components/ui/bubble";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Marker,
  MarkerContent,
  MarkerIcon,
} from "@/components/ui/marker";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  extractAgentActivity,
  extractEvidenceChips,
  type AgentActivityItem,
} from "@/lib/ai/agents/activity";
import {
  extractKnowledgeCitations,
  type KnowledgeCitation,
} from "@/lib/knowledge/citations";
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

function ToolIcon({ tool }: { tool: AgentActivityItem["tool"] }) {
  if (tool === "consultJira")
    return <Ticket className="size-3" aria-hidden="true" />;
  if (tool === "consultWeb")
    return <Globe className="size-3" aria-hidden="true" />;
  if (tool === "consultKnowledge" || tool === "consultBrief") {
    return <BookMarked className="size-3" aria-hidden="true" />;
  }
  if (tool === "proposeStories")
    return <PenLine className="size-3" aria-hidden="true" />;
  return <Bot className="size-3" aria-hidden="true" />;
}

function CitationsRow({ citations }: { citations: KnowledgeCitation[] }) {
  if (!citations.length) return null;
  return (
    <div className="flex max-w-[90%] min-w-0 flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground flex items-center gap-1 text-[10px]">
        <BookMarked className="size-3" aria-hidden="true" />
        دانش
      </span>
      {citations.map((c) => (
        <span
          key={c.docId || c.title}
          className="bg-muted text-muted-foreground max-w-48 truncate rounded-md px-1.5 py-0.5 text-[10px]"
          title={`${c.title} · ${c.source} · ${c.score}`}
        >
          {c.title}
        </span>
      ))}
    </div>
  );
}

function ActivityMarkers({ items }: { items: AgentActivityItem[] }) {
  if (!items.length) return null;
  return (
    <>
      {items.map((item) => (
        <Marker key={item.id} className="text-xs">
          <MarkerIcon>
            {item.state === "running" ? (
              <Spinner className="size-3" />
            ) : item.state === "error" ? (
              <X className="text-destructive size-3" aria-hidden="true" />
            ) : (
              <Check className="size-3 text-emerald-600" aria-hidden="true" />
            )}
          </MarkerIcon>
          <ToolIcon tool={item.tool} />
          <MarkerContent>
            {item.label}
            {item.detail ? ` — ${item.detail}` : ""}
            {item.state === "running"
              ? "…"
              : item.state === "error"
                ? " · خطا"
                : ""}
          </MarkerContent>
        </Marker>
      ))}
    </>
  );
}

export function WorkshopChatThread({
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
  const activityItems = extractAgentActivity(messages);
  const running = activityItems.filter((i) => i.state === "running");
  const recentDone = activityItems.filter((i) => i.state !== "running").slice(-4);

  const thinking =
    status === "submitted" ||
    (status === "streaming" &&
      messages.length > 0 &&
      messages[messages.length - 1]?.role === "assistant" &&
      !messageText(messages[messages.length - 1]!));

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <MessageScrollerProvider autoScroll>
        <MessageScroller className="min-h-72 flex-1 rounded-xl border">
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-4 p-3">
              {messages.length === 0 ? (
                <Empty className="border-0 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Bot />
                    </EmptyMedia>
                    <EmptyTitle>هنوز گفتگویی نیست</EmptyTitle>
                    <EmptyDescription>
                      پیش‌نویس را بنویس و مصاحبه را شروع کن.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : null}

              {messages.map((m) => {
                const text = messageText(m);
                const isUser = m.role === "user";
                const citations = isUser ? [] : extractKnowledgeCitations(m);
                const evidence = isUser ? [] : extractEvidenceChips(m);
                const quiz = isUser ? [] : askUserSummaries(m);
                const showBubble =
                  !!text || (status === "streaming" && !isUser);
                const align = isUser ? "end" : "start";

                return (
                  <MessageScrollerItem
                    key={m.id}
                    messageId={m.id}
                    scrollAnchor={isUser}
                  >
                    <Message align={align}>
                      <MessageAvatar>
                        <Avatar size="sm">
                          <AvatarFallback>
                            {isUser ? (
                              <User className="size-3.5" />
                            ) : (
                              <Bot className="size-3.5" />
                            )}
                          </AvatarFallback>
                        </Avatar>
                      </MessageAvatar>
                      <MessageContent>
                        <MessageHeader>
                          {isUser ? "شما" : "مصاحبه‌گر"}
                        </MessageHeader>
                        {showBubble ? (
                          <Bubble
                            variant={isUser ? "default" : "muted"}
                            align={align}
                          >
                            <BubbleContent>
                              {isUser ? (
                                <span className="whitespace-pre-wrap">
                                  {text}
                                </span>
                              ) : text ? (
                                <div className="[&_.markdown-body]:text-foreground [&_.markdown-body_p]:text-foreground [&_.markdown-body_li]:text-foreground">
                                  <MarkdownPreview text={text} />
                                </div>
                              ) : (
                                <span className="text-muted-foreground">…</span>
                              )}
                            </BubbleContent>
                          </Bubble>
                        ) : null}
                        {quiz.length > 0 ? (
                          <div className="bg-muted/60 flex max-w-[90%] min-w-0 flex-col gap-1.5 rounded-xl border px-3 py-2 text-xs">
                            <span className="text-muted-foreground">
                              جواب پرسشنامه
                            </span>
                            {quiz.map((a) => (
                              <div
                                key={`${a.name}-${a.question}`}
                                className="min-w-0"
                              >
                                <p className="text-muted-foreground truncate">
                                  {a.question}
                                </p>
                                <p className="break-words font-medium">
                                  {a.answer}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {!isUser ? (
                          <CitationsRow citations={citations} />
                        ) : null}
                        {!isUser ? (
                          <EvidenceChips
                            chips={evidence}
                            jiraBrowseBase={jiraBrowseBase}
                          />
                        ) : null}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                );
              })}

              {recentDone.length || running.length ? (
                <MessageScrollerItem messageId="agent-activity">
                  <div className="flex flex-col gap-1.5 px-1">
                    <ActivityMarkers items={[...recentDone, ...running]} />
                  </div>
                </MessageScrollerItem>
              ) : null}

              {thinking ? (
                <MessageScrollerItem messageId="thinking">
                  <Marker className="text-xs">
                    <MarkerIcon>
                      <Spinner className="size-3" />
                    </MarkerIcon>
                    <MarkerContent>در حال فکر…</MarkerContent>
                  </Marker>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>
    </div>
  );
}
