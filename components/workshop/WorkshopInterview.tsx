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
  Circle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
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

const EMPTY_COVERAGE: InterviewCoverage = {
  goal: false,
  user: false,
  acceptance: false,
  outOfScope: false,
  dependencies: false,
  risks: false,
};

type WorkshopInterviewProps = {
  onIssuesReady: (issues: RefinedIssue[]) => void;
  className?: string;
};

export default function WorkshopInterview({
  onIssuesReady,
  className,
}: WorkshopInterviewProps) {
  const { aiProvider, selectedModel } = useAiSettings();
  const { jiraUrl } = useJiraApp();
  const [draftText, setDraftText] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<InterviewCoverage>(EMPTY_COVERAGE);
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

  const busy =
    starting || status === "submitted" || status === "streaming";
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

  const beginSession = async (
    draft: string,
    payload: ComposerSendPayload
  ) => {
    setStarting(true);
    metaRef.current.forceWrite = false;
    metaRef.current.forcedDelegates = payload.forcedDelegates;
    try {
      const res = await fetch("/api/workshop/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          draftText: draft,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ساخت جلسه ناموفق");
      setSessionId(data.session.id);
      metaRef.current.sessionId = data.session.id;
      metaRef.current.draftText = draft;
      setDraftText(draft);
      setMessages([]);
      setCoverage(EMPTY_COVERAGE);
      const kickoff =
        payload.forcedDelegates.length > 0
          ? draft
          : `پیش‌نویس من:\n${draft}\n\nسوالات روشن‌سازی بپرس.`;
      await sendMessage({ text: kickoff });
      await refreshSession(data.session.id);
    } catch (e: any) {
      toast.error(e?.message || "خطا");
    } finally {
      setStarting(false);
      metaRef.current.forcedDelegates = [];
    }
  };

  const onSend = async (payload: ComposerSendPayload) => {
    const text = payload.text.trim();
    if ((!text && !payload.forcedDelegates.length) || busy) return;
    setInput("");

    if (!sessionId) {
      if (!text) {
        toast.error("متن را بنویس");
        return;
      }
      await beginSession(text, payload);
      return;
    }

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
    if (!sessionId || busy) {
      toast.error(sessionId ? "صبر کن…" : "اول پیام بفرست");
      return;
    }
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

  const restart = () => {
    if (busy) return;
    setSessionId(null);
    metaRef.current.sessionId = null;
    metaRef.current.draftText = "";
    metaRef.current.forcedDelegates = [];
    metaRef.current.forceWrite = false;
    setDraftText("");
    setMessages([]);
    setCoverage(EMPTY_COVERAGE);
    setInput("");
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
    <div className={cn("flex min-h-0 flex-col gap-2", className)}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
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
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!sessionId || savingKnowledge || busy}
            onClick={() => void saveConversationToKnowledge(true)}
          >
            {savingKnowledge ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <BookmarkPlus data-icon="inline-start" />
            )}
            ذخیره
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy || (!sessionId && !messages.length)}
            onClick={restart}
          >
            <RotateCcw data-icon="inline-start" />
            شروع دوباره
          </Button>
        </div>
      </div>

      <WorkshopChatThread
        messages={messages}
        status={status}
        className="min-h-0 flex-1"
        jiraBrowseBase={jiraUrl || null}
      />

      {error ? (
        <p className="text-destructive shrink-0 text-sm">{error.message}</p>
      ) : null}

      <AgentMentionComposer
        className="shrink-0"
        value={input}
        onChange={setInput}
        busy={busy}
        hasSession={!!sessionId}
        outputMode={outputMode}
        onOutputModeChange={setOutputMode}
        pendingAskUser={pendingAskUser}
        onAskUserAnswer={onAskUserAnswer}
        onSend={(payload) => void onSend(payload)}
        onForceWrite={() => void onForceWrite()}
      />
    </div>
  );
}
