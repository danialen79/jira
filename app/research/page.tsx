"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { BookmarkPlus, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import { useAiSettings } from "@/components/providers/ai-settings-provider";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useEffect, useMemo, useRef, useState } from "react";

function messageText(m: {
  parts?: Array<{ type: string; text?: string }>;
}): string {
  return (
    m.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text || "")
      .join("")
      .trim() || ""
  );
}

export default function ResearchPage() {
  const { aiProvider, selectedModel } = useAiSettings();
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const metaRef = useRef({ provider: aiProvider, model: selectedModel });
  metaRef.current.provider = aiProvider;
  metaRef.current.model = selectedModel;
  const lastAutoCount = useRef(0);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/research/chat",
        body: () => ({
          provider: metaRef.current.provider,
          model: metaRef.current.model,
        }),
      }),
    []
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  const saveTranscript = async (opts?: { silent?: boolean }) => {
    if (messages.length < 2) {
      if (!opts?.silent) toast.error("گفتگو برای ذخیره کافی نیست");
      return false;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "conversation",
          kind: "research",
          title: `Research ${new Date().toLocaleDateString("fa-IR")} ${new Date().toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`,
          messages,
          provider: aiProvider,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ذخیره ناموفق");
      if (!opts?.silent) {
        toast.success(`گفتگو در دانش ذخیره شد (${data.chunkCount} chunk)`);
      } else {
        toast.message("گفتگو به دانش اضافه شد");
      }
      return true;
    } catch (e: any) {
      if (!opts?.silent) toast.error(e?.message || "خطا");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Auto-ingest every 3 completed assistant replies
  useEffect(() => {
    if (busy) return;
    const assistantCount = messages.filter(
      (m) => m.role === "assistant" && messageText(m).length > 20
    ).length;
    if (assistantCount > 0 && assistantCount % 3 === 0) {
      if (assistantCount !== lastAutoCount.current) {
        lastAutoCount.current = assistantCount;
        void saveTranscript({ silent: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, messages.length]);

  const onSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    try {
      await sendMessage({ text });
    } catch (e: any) {
      toast.error(e?.message || "ارسال ناموفق");
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-3" dir="rtl">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Search className="text-primary size-6" />
            Research
          </h2>
          <p className="text-muted-foreground text-sm">
            سوال بپرس؛ گفتگو هر ۳ پاسخ به‌صورت خودکار به دانش می‌رود.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={saving || messages.length < 2}
          onClick={() => void saveTranscript()}
        >
          {saving ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <BookmarkPlus data-icon="inline-start" />
          )}
          ذخیره گفتگو در دانش
        </Button>
      </div>

      <ChatMessageList messages={messages} status={status} />

      {error && <p className="text-destructive text-sm">{error.message}</p>}

      <Field>
        <FieldLabel className="sr-only">پیام</FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            value={input}
            rows={2}
            placeholder="سوال محصول یا ریسرچ…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
          />
          <InputGroupAddon align="block-end">
            {busy ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => stop()}
              >
                توقف
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => void onSend()}>
                <Send data-icon="inline-start" />
                ارسال
              </Button>
            )}
            {busy && <Spinner />}
          </InputGroupAddon>
        </InputGroup>
      </Field>
    </div>
  );
}
