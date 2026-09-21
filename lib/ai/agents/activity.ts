import type { UIMessage } from "ai";
import type { EvidenceCard, ResearchBrief } from "@/lib/ai/evidence";

export type EvidenceChip = {
  kind: "knowledge" | "jira" | "web";
  ref: string;
  snippet?: string;
  claim?: string;
};

function briefFromOutput(output: unknown): ResearchBrief | null {
  if (!output || typeof output !== "object") return null;
  const o = output as { brief?: ResearchBrief; cards?: EvidenceCard[] };
  if (o.brief && Array.isArray(o.brief.cards)) return o.brief;
  if (Array.isArray(o.cards)) {
    return {
      summary: typeof (o as { summary?: string }).summary === "string"
        ? (o as { summary: string }).summary
        : "",
      cards: o.cards,
    };
  }
  return null;
}

const CONSULT_TYPES = new Set([
  "tool-consultKnowledge",
  "tool-consultJira",
  "tool-consultWeb",
  "tool-consultBrief",
]);

export function extractEvidenceChips(message: UIMessage): EvidenceChip[] {
  const chips: EvidenceChip[] = [];
  const seen = new Set<string>();

  for (const part of message.parts || []) {
    if (!part || typeof part !== "object" || !("type" in part)) continue;
    const type = String(part.type);
    if (!CONSULT_TYPES.has(type)) continue;
    const p = part as { state?: string; output?: unknown };
    if (p.state !== "output-available") continue;
    const brief = briefFromOutput(p.output);
    if (!brief) continue;
    for (const card of brief.cards) {
      for (const s of card.sources) {
        const key = `${s.kind}:${s.ref}`;
        if (seen.has(key)) continue;
        seen.add(key);
        chips.push({
          kind: s.kind,
          ref: s.ref,
          snippet: s.snippet,
          claim: card.claim,
        });
      }
    }
  }

  return chips;
}

export type AgentActivityItem = {
  id: string;
  tool:
    | "consultKnowledge"
    | "consultJira"
    | "consultWeb"
    | "consultBrief"
    | "proposeStories"
    | "updateCoverage"
    | "askUser"
    | "other";
  label: string;
  state: "running" | "done" | "error";
  detail?: string;
};

const TOOL_LABELS: Record<string, string> = {
  consultKnowledge: "دانش",
  consultJira: "جیرا",
  consultWeb: "وب",
  consultBrief: "خلاصه موازی",
  proposeStories: "استوری‌ها",
  updateCoverage: "پوشش",
  askUser: "پرسشنامه",
};

function toolNameFromPartType(type: string): string {
  if (type.startsWith("tool-")) return type.slice(5);
  return type;
}

export function extractAgentActivity(
  messages: UIMessage[]
): AgentActivityItem[] {
  const items: AgentActivityItem[] = [];
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    for (const part of m.parts || []) {
      if (!part || typeof part !== "object" || !("type" in part)) continue;
      const type = String(part.type);
      if (!type.startsWith("tool-")) continue;
      const name = toolNameFromPartType(type);
      if (
        ![
          "consultKnowledge",
          "consultJira",
          "consultWeb",
          "consultBrief",
          "proposeStories",
          "updateCoverage",
          "askUser",
        ].includes(name)
      ) {
        continue;
      }
      const p = part as {
        toolCallId?: string;
        state?: string;
        input?: { question?: string; hints?: string; topic?: string; intent?: string };
        errorText?: string;
      };
      let state: AgentActivityItem["state"] = "running";
      if (p.state === "output-available") state = "done";
      if (p.state === "output-error") state = "error";
      if (p.state === "input-streaming" || p.state === "input-available") {
        state = "running";
      }

      const detail =
        p.input?.question ||
        p.input?.topic ||
        p.input?.hints ||
        (p.input?.intent ? `intent: ${p.input.intent}` : undefined) ||
        p.errorText;

      items.push({
        id: p.toolCallId || `${m.id}-${name}-${items.length}`,
        tool: name as AgentActivityItem["tool"],
        label: TOOL_LABELS[name] || name,
        state,
        detail: detail ? String(detail).slice(0, 80) : undefined,
      });
    }
  }
  // Keep latest unique tools by id order; show last 8
  return items.slice(-8);
}
