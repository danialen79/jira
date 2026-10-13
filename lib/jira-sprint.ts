/**
 * Parse Jira Sprint custom field values.
 *
 * Server/DC often returns GreenHopper toString blobs (or arrays of them):
 *   com.atlassian.greenhopper.service.sprint.Sprint@…[id=67,name=SIP Sprint 18,state=FUTURE,…]
 * Cloud / newer APIs may return objects or arrays of objects with id/name/state.
 */

export type ParsedSprint = {
  id: string;
  name?: string;
  state?: string;
};

function parseSprintToString(raw: string): ParsedSprint | null {
  const idMatch = raw.match(/id=(\d+)/i);
  if (!idMatch?.[1]) return null;
  const nameMatch = raw.match(/name=([^,\]]+)/i);
  const stateMatch = raw.match(/state=([^,\]]+)/i);
  return {
    id: idMatch[1],
    name: nameMatch?.[1]?.trim() || undefined,
    state: stateMatch?.[1]?.trim() || undefined,
  };
}

function parseSprintObject(raw: Record<string, unknown>): ParsedSprint | null {
  const id = raw.id;
  if (id == null || id === "") return null;
  const name = raw.name;
  const state = raw.state;
  return {
    id: String(id),
    name: typeof name === "string" && name.trim() ? name.trim() : undefined,
    state: typeof state === "string" && state.trim() ? state.trim() : undefined,
  };
}

function parseOneSprint(raw: unknown): ParsedSprint | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { id: String(raw) };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Pure numeric id
    if (/^\d+$/.test(trimmed)) return { id: trimmed };
    return parseSprintToString(trimmed);
  }
  if (raw && typeof raw === "object") {
    return parseSprintObject(raw as Record<string, unknown>);
  }
  return null;
}

function isActiveState(state?: string): boolean {
  return (state || "").toLowerCase() === "active";
}

/**
 * Prefer the active sprint when history is present; otherwise the last entry
 * (Jira usually appends the current/most recent sprint).
 */
export function pickCurrentSprint(
  entries: ParsedSprint[]
): ParsedSprint | undefined {
  if (entries.length === 0) return undefined;
  return entries.find((s) => isActiveState(s.state)) || entries[entries.length - 1];
}

function toResult(sprint: ParsedSprint): {
  selectedSprint: string;
  sprintName?: string;
} {
  return sprint.name
    ? { selectedSprint: sprint.id, sprintName: sprint.name }
    : { selectedSprint: sprint.id };
}

export function parseJiraSprintField(raw: unknown): {
  selectedSprint?: string;
  sprintName?: string;
} {
  if (raw == null || raw === "") return {};

  if (Array.isArray(raw)) {
    const entries = raw
      .map(parseOneSprint)
      .filter((s): s is ParsedSprint => Boolean(s));
    const current = pickCurrentSprint(entries);
    if (!current) return {};
    return toResult(current);
  }

  const one = parseOneSprint(raw);
  if (!one) return {};
  return toResult(one);
}
