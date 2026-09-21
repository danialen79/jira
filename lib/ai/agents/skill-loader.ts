import { readFileSync } from "fs";
import { join } from "path";

const skillRoot = join(
  process.cwd(),
  ".cursor",
  "skills",
  "workshop-interview"
);

const cache = new Map<string, string>();

function readSkill(rel: string): string {
  const cached = cache.get(rel);
  if (cached) return cached;
  const text = readFileSync(join(skillRoot, rel), "utf8");
  cache.set(rel, text);
  return text;
}

export function loadOrchestratorSkill(): string {
  return readSkill("SKILL.md");
}

export function loadKnowledgeLibrarianSkill(): string {
  return [
    readSkill("subagents/knowledge-librarian.md"),
    readSkill("protocols/evidence-card.md"),
  ].join("\n\n");
}

export function loadJiraScoutSkill(): string {
  return [
    readSkill("subagents/jira-scout.md"),
    readSkill("protocols/evidence-card.md"),
  ].join("\n\n");
}

export function loadWebScoutSkill(): string {
  return [
    readSkill("subagents/web-scout.md"),
    readSkill("protocols/evidence-card.md"),
  ].join("\n\n");
}

export function loadCoverageGates(): string {
  return readSkill("protocols/coverage-gates.md");
}

export function loadStoryDescriptionProtocol(): string {
  return readSkill("protocols/story-description.md");
}
