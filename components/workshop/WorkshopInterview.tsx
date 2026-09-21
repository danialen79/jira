"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";
import {
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  Circle,
  MessageSquareMore,
} from "lucide-react";
import { toast } from "sonner";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  AgentMentionComposer,
  type ComposerSendPayload,
} from "@/components/workshop/AgentMentionComposer";
import { WorkshopChatThread } from "@/components/workshop/WorkshopChatThread";
import type { AskUserToolPart } from "@/components/workshop/InterviewQuestionCard";
import type { AskUserOutput } from "@/lib/ai/tools";
import type { ForcedDelegate } from "@/lib/ai/agents/workshop-agents";
import type { RefinedIssue } from "@/lib/types";
import { useJiraApp } from "@/components/providers/jira-app-provider";
import { cn } from "@/lib/utils";

function findPendingAskUser(messages: UIMessage[]): AskUserToolPart | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (!m || m.role !== "assistant") continue;
    for (const part of m.parts || []) {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        part.type === "tool-askUser" &&
        "state" in part &&
        (part.state === "input-available" || part.state === "input-streaming")
      ) {
        return part as AskUserToolPart;
      }
    }
  }
  return null;
}

type InterviewCoverage = {
  goal: boolean;
  user: boolean;
  acceptance: boolean;
  outOfScope: boolean;
  dependencies: boolean;
  risks: boolean;
};

const COVERAGE_LABELS: Array<{ key: keyof InterviewCoverage; label: string }> =
  [
    { key: "goal", label: "هدف" },
    { key: "user", label: "کاربر" },
    { key: "acceptance", label: "پذیرش" },
    { key: "outOfScope", label: "خارج scope" },
    { key: "dependencies", label: "وابستگی" },
    { key: "risks", label: "ریسک" },
  ];

type WorkshopInterviewProps = {
  onIssuesReady: (issues: RefinedIssue[]) => void;
};

export default function WorkshopInterview({
  onIssuesReady,
}: WorkshopInterviewProps) {
  const { aiProvider, selectedModel } = useAiSettings();
  const { jiraUrl } = useJiraApp();
  const [draftText, setDraftText] = useState("");
  const [draftOpen, setDraftOpen] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<InterviewCoverage>({
    goal: false,
    user: false,
    acceptance: false,
    outOfScope: false,
    dependencies: false,
    risks: false,
  });
  const [outputMode, setOutputMode] = useState("both");
  const [input, setInput] = useState("");
  const [starting, setStarting] = useState(false);

  const metaRef = useRef({
    sessionId: null as string | null,
    draftText: "",
    outputMode: "both",
    forceWrite: false,
    forcedDelegates: [] as ForcedDelegate[],
    provider: aiProvider,
    model: selectedModel,
  });
  metaRef.current.sessionId = sessionId;
  metaRef.current.draftText = draftText;
  metaRef.current.outputMode = outputMode;
  metaRef.current.provider = aiProvider;
  metaRef.current.model = selectedModel;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/workshop/interview",
        body: () => ({
          provider: metaRef.current.provider,
          model: metaRef.current.model,
          sessionId: metaRef.current.sessionId,
          draftText: metaRef.current.draftText,
          outputMode: metaRef.current.outputMode,
          forceWrite: metaRef.current.forceWrite,
          forcedDelegates: metaRef.current.forcedDelegates,
        }),
      }),
    []
  );

  const { messages, sendMessage, status, setMessages, error, addToolOutput } =
    useChat({
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    });

  const busy = status === "submitted" || status === "streaming";
  const pendingAskUser = useMemo(
    () => findPendingAskUser(messages),
    [messages]
  );

  const onAskUserAnswer = useCallback(
    (toolCallId: string, output: AskUserOutput) => {
      void addToolOutput({
        tool: "askUser",
        toolCallId,
        output,
      });
    },
    [addToolOutput]
  );

  function applyIssues(raw: any[]) {
    const stamp = Date.now();
    const idMap = new Map<string, string>();
    let epicSeq = 0;
    let storySeq = 0;
    let bugSeq = 0;

    const rows = raw.map((issue, index) => {
      const aiId = String(issue?.id ?? "").trim();
      const id = aiId || `interview-${stamp}-${index}`;
      if (aiId) idMap.set(aiId, id);
      idMap.set(String(index), id);

      const type = String(issue?.issuetype || "");
      if (type === "Epic") {
        epicSeq += 1;
        idMap.set(`epic-${epicSeq}`, id);
      } else if (type === "Story") {
        storySeq += 1;
        idMap.set(`story-${storySeq}`, id);
      } else if (type === "Bug") {
        bugSeq += 1;
        idMap.set(`bug-${bugSeq}`, id);
      }

      return { issue, id };
    });

    for (const { issue, id } of rows) {
      if (issue?.issuetype === "Epic" && issue?.summary) {
        idMap.set(String(issue.summary).trim(), id);
      }
    }

    const epicIds = new Set(
      rows.filter((r) => r.issue?.issuetype === "Epic").map((r) => r.id)
    );

    const issues: RefinedIssue[] = rows.map(({ issue, id }) => {
      let epicReference = issue?.epicReference
        ? String(issue.epicReference).trim()
        : undefined;
      if (epicReference) {
        const mapped = idMap.get(epicReference);
        if (mapped) epicReference = mapped;
        if (!epicIds.has(epicReference)) {
          epicReference = undefined;
        }
      }

      const issuetype =
        (issue?.issuetype as RefinedIssue["issuetype"]) || "Story";

      return {
        id,
        summary: String(issue?.summary || ""),
        description: String(issue?.description || ""),
        issuetype,
        epicReference: issuetype === "Epic" ? undefined : epicReference,
        suggestedPriority: issue?.suggestedPriority,
        suggestedComponent: issue?.suggestedComponent,
        selectedPriority: issue?.suggestedPriority || "Medium",
        selectedComponent: issue?.suggestedComponent || undefined,
        status: "draft" as const,
      };
    });

    onIssuesReady(issues);
    toast.success(`${issues.length} آیتم آماده شد`);
  }

  const refreshSession = useCallback(
    async (id: string) => {
      const res = await fetch("/api/workshop/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", sessionId: id }),
      });
      const data = await res.json();
      if (data.session?.coverage) setCoverage(data.session.coverage);
      if (data.session?.output?.issues) {
        applyIssues(data.session.output.issues);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onIssuesReady]
  );

  const prevStatusRef = useRef(status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;
    if (
      sessionId &&
      (prev === "streaming" || prev === "submitted") &&
      status === "ready"
    ) {
      void refreshSession(sessionId);
    }
  }, [status, sessionId, refreshSession]);

  const hydrateLatest = useCallback(async () => {
    try {
      const res = await fetch("/api/workshop/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "latest" }),
      });
      const data = await res.json();
      if (data.session) {
        setSessionId(data.session.id);
        setDraftText(data.session.draftText || "");
        if (data.session.messages?.length) setDraftOpen(false);
        if (data.session.coverage) setCoverage(data.session.coverage);
        if (Array.isArray(data.session.messages)) {
          setMessages(
            data.session.messages.map(
              (m: { role: string; content: string }, i: number) => ({
                id: `hist-${i}`,
                role: m.role === "assistant" ? "assistant" : "user",
                parts: [{ type: "text" as const, text: m.content }],
              })
            )
          );
        }
        if (data.session.output?.issues) {
          applyIssues(data.session.output.issues);
        }
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMessages]);

  useEffect(() => {
    void hydrateLatest();
  }, [hydrateLatest]);

  const startInterview = async () => {
    if (!draftText.trim()) {
      toast.error("پیش‌نویس را بنویس");
      return;
    }
    setStarting(true);
    metaRef.current.forceWrite = false;
    metaRef.current.forcedDelegates = [];
    try {
      const res = await fetch("/api/workshop/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          draftText: draftText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ساخت جلسه ناموفق");
      setSessionId(data.session.id);
      metaRef.current.sessionId = data.session.id;
      metaRef.current.draftText = draftText.trim();
      setMessages([]);
      setCoverage({
        goal: false,
        user: false,
        acceptance: false,
        outOfScope: false,
        dependencies: false,
        risks: false,
      });
      setDraftOpen(false);
      await sendMessage({
        text: `پیش‌نویس من:\n${draftText.trim()}\n\nسوالات روشن‌سازی بپرس.`,
      });
      await refreshSession(data.session.id);
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    } finally {
      setStarting(false);
    }
  };

  const onSend = async (payload: ComposerSendPayload) => {
    const text = payload.text.trim();
    if ((!text && !payload.forcedDelegates.length) || busy || !sessionId)
      return;
    setInput("");
    metaRef.current.forceWrite = false;
    metaRef.current.forcedDelegates = payload.forcedDelegates;
    try {
      await sendMessage({ text: text || "ادامه بده." });
      await refreshSession(sessionId);
    } catch (e: any) {
      toast.error(e?.message || "ارسال ناموفق");
    } finally {
      metaRef.current.forcedDelegates = [];
    }
  };

  const onForceWrite = async () => {
    if (!sessionId || busy) return;
    metaRef.current.forceWrite = true;
    metaRef.current.forcedDelegates = [
      { agent: "stories", task: "استوری‌ها را روی برد بنویس" },
    ];
    try {
      await sendMessage({ text: "کافی است؛ استوری‌ها را بنویس." });
      await refreshSession(sessionId);
    } catch (e: any) {
      toast.error(e?.message || "نوشتن ناموفق");
    } finally {
      metaRef.current.forceWrite = false;
      metaRef.current.forcedDelegates = [];
    }
  };

  const [savingKnowledge, setSavingKnowledge] = useState(false);

  const saveConversationToKnowledge = async (force = false) => {
    if (!sessionId) {
      toast.error("جلسه‌ای نیست");
      return;
    }
    setSavingKnowledge(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "conversation",
          kind: "workshop",
          sessionId,
          provider: aiProvider,
          force,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ذخیره ناموفق");
      if (data.skipped) toast.message(data.message || "قبلاً ذخیره شده");
      else toast.success(`گفتگو در دانش ذخیره شد (${data.chunkCount} chunk)`);
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    } finally {
      setSavingKnowledge(false);
    }
  };

  return (
    <div className="flex min-h-[32rem] flex-col gap-3 lg:min-h-[36rem]">
      <Collapsible open={draftOpen} onOpenChange={setDraftOpen}>
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 rounded-md px-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                draftOpen ? "rotate-0" : "-rotate-90"
              )}
            />
            پیش‌نویس
          </CollapsibleTrigger>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!sessionId || savingKnowledge || busy}
              onClick={() => void saveConversationToKnowledge(true)}
            >
              {savingKnowledge ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <BookmarkPlus data-icon="inline-start" />
              )}
              ذخیره دانش
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={starting || busy || !draftText.trim()}
              onClick={() => void startInterview()}
            >
              {starting || busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <MessageSquareMore data-icon="inline-start" />
              )}
              {sessionId ? "شروع دوباره" : "شروع مصاحبه"}
            </Button>
          </div>
        </div>
        <CollapsibleContent className="pt-2">
          <FieldGroup>
            <Field>
              <FieldLabel>پیش‌نویس</FieldLabel>
              <Textarea
                rows={4}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder="گلوله یا نیاز را بنویس…"
              />
            </Field>
            <Field>
              <FieldLabel>خروجی</FieldLabel>
              <ToggleGroup
                value={[outputMode]}
                onValueChange={(values) => {
                  if (!values.length) return;
                  setOutputMode(values[0]!);
                }}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="both">همه</ToggleGroupItem>
                <ToggleGroupItem value="epics">اپیک</ToggleGroupItem>
                <ToggleGroupItem value="stories">استوری</ToggleGroupItem>
                <ToggleGroupItem value="bugs">باگ</ToggleGroupItem>
              </ToggleGroup>
            </Field>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-wrap gap-1.5">
        {COVERAGE_LABELS.map(({ key, label }) => (
          <Badge
            key={key}
            variant={coverage[key] ? "success" : "secondary"}
            className="gap-1"
          >
            {coverage[key] ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <Circle className="size-3" />
            )}
            {label}
          </Badge>
        ))}
      </div>

      <WorkshopChatThread
        messages={messages}
        status={status}
        className="min-h-0 flex-1"
        jiraBrowseBase={jiraUrl || null}
      />

      {error ? (
        <p className="text-destructive text-sm">{error.message}</p>
      ) : null}

      <AgentMentionComposer
        value={input}
        onChange={setInput}
        disabled={!sessionId}
        busy={busy}
        pendingAskUser={pendingAskUser}
        onAskUserAnswer={onAskUserAnswer}
        onSend={(payload) => void onSend(payload)}
        onForceWrite={() => void onForceWrite()}
      />
    </div>
  );
}
