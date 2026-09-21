export type WorkshopAgentKey =
  | "knowledge"
  | "jira"
  | "web"
  | "brief"
  | "stories";

export type ForcedDelegate = {
  agent: WorkshopAgentKey;
  task: string;
};

export type WorkshopAgentDef = {
  key: WorkshopAgentKey;
  /** Trigger tokens after @ (lowercase) */
  aliases: string[];
  label: string;
  hint: string;
  tool: string;
};

export const WORKSHOP_AGENTS: WorkshopAgentDef[] = [
  {
    key: "knowledge",
    aliases: ["دانش", "knowledge", "librarian"],
    label: "دانش",
    hint: "جستجو در دانش محصول",
    tool: "consultKnowledge",
  },
  {
    key: "jira",
    aliases: ["جیرا", "jira", "scout"],
    label: "جیرا",
    hint: "بررسی JQL / تکراری",
    tool: "consultJira",
  },
  {
    key: "web",
    aliases: ["وب", "web"],
    label: "وب",
    hint: "جستجوی وب",
    tool: "consultWeb",
  },
  {
    key: "brief",
    aliases: ["خلاصه", "brief", "موازی"],
    label: "خلاصه",
    hint: "دانش + جیرا موازی",
    tool: "consultBrief",
  },
  {
    key: "stories",
    aliases: ["استوری‌نویس", "استوری", "stories", "برد"],
    label: "استوری‌نویس",
    hint: "نوشتن روی برد",
    tool: "proposeStories",
  },
];

const ALIAS_MAP = new Map<string, WorkshopAgentKey>();
for (const a of WORKSHOP_AGENTS) {
  for (const alias of a.aliases) {
    ALIAS_MAP.set(alias.toLowerCase(), a.key);
  }
}

export function resolveAgentAlias(token: string): WorkshopAgentKey | null {
  return ALIAS_MAP.get(token.toLowerCase().trim()) ?? null;
}

export function agentDef(key: WorkshopAgentKey): WorkshopAgentDef {
  return WORKSHOP_AGENTS.find((a) => a.key === key)!;
}

export function parseForcedDelegates(
  raw: unknown
): ForcedDelegate[] {
  if (!Array.isArray(raw)) return [];
  const out: ForcedDelegate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const agent = String((item as { agent?: string }).agent || "").trim();
    const task = String((item as { task?: string }).task || "").trim();
    if (!WORKSHOP_AGENTS.some((a) => a.key === agent)) continue;
    out.push({ agent: agent as WorkshopAgentKey, task });
  }
  return out;
}

export function forcedDelegatesForceWrite(
  delegates: ForcedDelegate[]
): boolean {
  return delegates.some((d) => d.agent === "stories");
}

export function formatForcedDelegatesPrompt(
  delegates: ForcedDelegate[]
): string {
  if (!delegates.length) return "";
  const lines = delegates.map((d) => {
    const def = agentDef(d.agent);
    const task = d.task || "(use conversation context)";
    return `- MUST call \`${def.tool}\` this turn. Task: ${task}`;
  });
  return `
USER FORCED DELEGATES (hard requirements for THIS turn only):
${lines.join("\n")}
Call these tools before askUser (except stories: after a quick consultJira intent=similar if possible, then proposeStories). Do not skip them.
`;
}
