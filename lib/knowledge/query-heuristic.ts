const SHORT_QUERY_CHARS = 240;
const MAX_QUERIES = 4;

export function heuristicSearchQueries(input: {
  draft?: string;
  userText?: string;
}): string[] {
  const draft = (input.draft || "").replace(/\r\n/g, "\n").trim();
  const userText = (input.userText || "").replace(/\r\n/g, "\n").trim();
  const combined = [draft, userText].filter(Boolean).join("\n");
  if (!combined) return [];
  if (combined.length <= SHORT_QUERY_CHARS) return [combined];

  const queries: string[] = [];
  const push = (value: string) => {
    const text = value.replace(/^#{1,6}\s*/, "").trim().slice(0, 200);
    if (!text || queries.includes(text)) return;
    queries.push(text);
  };

  const lines = draft
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0]) push(lines[0]);
  for (const line of lines) {
    if (!line.startsWith("#")) continue;
    push(line);
    if (queries.length >= MAX_QUERIES - (userText ? 1 : 0)) break;
  }
  if (userText) {
    const first = userText
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean);
    if (first) push(first);
  }
  if (!queries.length) push(combined.slice(0, 200));
  return queries.slice(0, MAX_QUERIES);
}
