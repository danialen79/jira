"use client";

import { useMemo, useRef, useState } from "react";
import { AtSign, Bot, PenLine, Send, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  InterviewQuestionCard,
  type AskUserToolPart,
} from "@/components/workshop/InterviewQuestionCard";
import {
  WORKSHOP_AGENTS,
  agentDef,
  resolveAgentAlias,
  type ForcedDelegate,
  type WorkshopAgentKey,
} from "@/lib/ai/agents/workshop-agents";
import type { AskUserOutput } from "@/lib/ai/tools";
import { cn } from "@/lib/utils";

export type ComposerSendPayload = {
  text: string;
  forcedDelegates: ForcedDelegate[];
};

/** Parse @mentions into forced delegates; keep free text without @tokens. */
export function parseComposerMentions(raw: string): ComposerSendPayload {
  const text = raw.trim();
  if (!text) return { text: "", forcedDelegates: [] };

  const re = /@([^\s@]+)/g;
  const matches: Array<{
    index: number;
    end: number;
    key: WorkshopAgentKey;
  }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = resolveAgentAlias(m[1]!);
    if (!key) continue;
    matches.push({
      index: m.index,
      end: m.index + m[0].length,
      key,
    });
  }

  if (!matches.length) {
    return { text, forcedDelegates: [] };
  }

  const forcedDelegates: ForcedDelegate[] = matches.map((hit, i) => {
    const taskStart = hit.end;
    const taskEnd =
      i + 1 < matches.length ? matches[i + 1]!.index : text.length;
    const task = text.slice(taskStart, taskEnd).trim();
    return { agent: hit.key, task };
  });

  let clean = text;
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const hit = matches[i]!;
    clean = clean.slice(0, hit.index) + clean.slice(hit.end);
  }
  clean = clean.replace(/\s{2,}/g, " ").trim();

  return { text: clean || text, forcedDelegates };
}

function mentionChipsFromText(raw: string): ForcedDelegate[] {
  return parseComposerMentions(raw).forcedDelegates;
}

type AgentMentionComposerProps = {
  value: string;
  onChange: (value: string) => void;
  busy?: boolean;
  hasSession?: boolean;
  outputMode: string;
  onOutputModeChange: (mode: string) => void;
  pendingAskUser: AskUserToolPart | null;
  onAskUserAnswer: (toolCallId: string, output: AskUserOutput) => void;
  onSend: (payload: ComposerSendPayload) => void;
  onForceWrite: () => void;
  className?: string;
};

export function AgentMentionComposer({
  value,
  onChange,
  busy,
  hasSession,
  outputMode,
  onOutputModeChange,
  pendingAskUser,
  onAskUserAnswer,
  onSend,
  onForceWrite,
  className,
}: AgentMentionComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [buttonOpen, setButtonOpen] = useState(false);

  const chips = useMemo(() => mentionChipsFromText(value), [value]);

  const filteredAgents = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    if (!q) return WORKSHOP_AGENTS;
    return WORKSHOP_AGENTS.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.hint.toLowerCase().includes(q) ||
        a.aliases.some((al) => al.toLowerCase().includes(q))
    );
  }, [mentionQuery]);

  const insertMention = (key: WorkshopAgentKey) => {
    const def = agentDef(key);
    const token = `@${def.label} `;
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;

    let replaceFrom = start;
    const before = value.slice(0, start);
    const atIdx = before.lastIndexOf("@");
    if (atIdx >= 0 && !/\s/.test(before.slice(atIdx + 1))) {
      replaceFrom = atIdx;
    }

    const next = value.slice(0, replaceFrom) + token + value.slice(end);
    onChange(next);
    setMentionOpen(false);
    setMentionQuery("");
    setButtonOpen(false);
    requestAnimationFrame(() => {
      const pos = replaceFrom + token.length;
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  };

  const removeChip = (agent: WorkshopAgentKey) => {
    const def = agentDef(agent);
    const re = new RegExp(`@${def.label}\\s*`, "g");
    onChange(value.replace(re, "").replace(/\s{2,}/g, " ").trim());
  };

  const handleChange = (next: string) => {
    onChange(next);
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? next.length;
    const before = next.slice(0, caret);
    const atIdx = before.lastIndexOf("@");
    if (atIdx >= 0) {
      const fragment = before.slice(atIdx + 1);
      if (!/\s/.test(fragment) && fragment.length < 24) {
        setMentionQuery(fragment);
        setMentionOpen(true);
        return;
      }
    }
    setMentionOpen(false);
    setMentionQuery("");
  };

  const submit = () => {
    const payload = parseComposerMentions(value);
    if (!payload.text.trim() && !payload.forcedDelegates.length) return;
    if (!payload.text.trim() && payload.forcedDelegates.length) {
      payload.text = payload.forcedDelegates
        .map((d) => {
          const def = agentDef(d.agent);
          return d.task
            ? `با ${def.label}: ${d.task}`
            : `با ${def.label} کار کن.`;
        })
        .join("\n");
    }
    onSend(payload);
  };

  if (pendingAskUser) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <InterviewQuestionCard
          part={pendingAskUser}
          onAnswer={onAskUserAnswer}
          embedded
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => {
            const def = agentDef(c.agent);
            return (
              <Badge
                key={`${c.agent}-${c.task.slice(0, 12)}`}
                variant="secondary"
                className="max-w-full gap-1 font-normal"
              >
                <AtSign className="size-3" aria-hidden="true" />
                <span className="truncate">
                  {def.label}
                  {c.task ? `: ${c.task}` : ""}
                </span>
                <button
                  type="button"
                  className="hover:text-foreground ms-0.5 cursor-pointer"
                  aria-label={`حذف ${def.label}`}
                  onClick={() => removeChip(c.agent)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}

      <div className="relative">
        <InputGroup>
          <InputGroupTextarea
            ref={textareaRef}
            rows={hasSession ? 2 : 3}
            value={value}
            disabled={busy}
            placeholder={
              hasSession
                ? "جواب… یا @ برای ایجنت"
                : "نیاز یا پیش‌نویس را بنویس… Enter بفرست"
            }
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={(e) => {
              if (
                mentionOpen &&
                (e.key === "ArrowDown" || e.key === "ArrowUp")
              ) {
                return;
              }
              if (e.key === "Escape" && mentionOpen) {
                e.preventDefault();
                setMentionOpen(false);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!mentionOpen) submit();
              }
            }}
          />
          <InputGroupAddon align="block-end" className="justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Popover open={buttonOpen} onOpenChange={setButtonOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                    />
                  }
                >
                  <Bot data-icon="inline-start" />
                  ایجنت
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 p-0">
                  <Command>
                    <CommandList>
                      <CommandEmpty>یافت نشد</CommandEmpty>
                      <CommandGroup>
                        {WORKSHOP_AGENTS.map((a) => (
                          <CommandItem
                            key={a.key}
                            value={`${a.label} ${a.hint}`}
                            onSelect={() => insertMention(a.key)}
                          >
                            <span className="font-medium">{a.label}</span>
                            <span className="text-muted-foreground ms-auto text-xs">
                              {a.hint}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <ToggleGroup
                value={[outputMode]}
                onValueChange={(values) => {
                  if (!values.length) return;
                  onOutputModeChange(values[0]!);
                }}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="both">همه</ToggleGroupItem>
                <ToggleGroupItem value="epics">اپیک</ToggleGroupItem>
                <ToggleGroupItem value="stories">استوری</ToggleGroupItem>
                <ToggleGroupItem value="bugs">باگ</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !hasSession}
                onClick={() => onForceWrite()}
              >
                <PenLine data-icon="inline-start" />
                بنویس روی برد
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busy || (!value.trim() && !chips.length)}
                onClick={() => submit()}
              >
                {busy ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                {hasSession ? "ارسال" : "شروع"}
              </Button>
            </div>
          </InputGroupAddon>
        </InputGroup>

        {mentionOpen ? (
          <div className="bg-popover absolute inset-x-0 bottom-full z-50 mb-1 overflow-hidden rounded-lg border shadow-md">
            <Command shouldFilter={false}>
              <CommandList>
                <CommandEmpty>ایجنتی نیست</CommandEmpty>
                <CommandGroup heading="ایجنت‌ها">
                  {filteredAgents.map((a) => (
                    <CommandItem
                      key={a.key}
                      value={a.key}
                      onSelect={() => insertMention(a.key)}
                    >
                      <AtSign className="size-3.5" aria-hidden="true" />
                      <span className="font-medium">{a.label}</span>
                      <span className="text-muted-foreground ms-auto text-xs">
                        {a.hint}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        ) : null}
      </div>
    </div>
  );
}
