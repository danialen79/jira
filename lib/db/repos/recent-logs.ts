import { getDb, nowIso } from "@/lib/db";

export type RecentWorklog = {
  id: string;
  issueKey: string;
  summary: string;
  parentKey?: string;
  timeSpent: string;
  comment: string;
  url: string;
  timestamp: string;
};

const MAX_RECENT = 50;

function mapRow(row: {
  id: string;
  issue_key: string;
  summary: string;
  parent_key: string | null;
  time_spent: string;
  comment: string;
  url: string;
  created_at: string;
}): RecentWorklog {
  return {
    id: row.id,
    issueKey: row.issue_key,
    summary: row.summary,
    parentKey: row.parent_key || undefined,
    timeSpent: row.time_spent,
    comment: row.comment,
    url: row.url,
    timestamp: row.created_at,
  };
}

export function listRecentWorklogs(limit = MAX_RECENT): RecentWorklog[] {
  const rows = getDb()
    .prepare(
      `SELECT id, issue_key, summary, parent_key, time_spent, comment, url, created_at
       FROM recent_worklogs
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: string;
    issue_key: string;
    summary: string;
    parent_key: string | null;
    time_spent: string;
    comment: string;
    url: string;
    created_at: string;
  }>;
  return rows.map(mapRow);
}

export function addRecentWorklog(input: {
  id?: string;
  issueKey: string;
  summary: string;
  parentKey?: string;
  timeSpent: string;
  comment?: string;
  url?: string;
  timestamp?: string;
}): RecentWorklog {
  const id = input.id || crypto.randomUUID();
  const createdAt = input.timestamp || nowIso();
  const db = getDb();

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO recent_worklogs
       (id, issue_key, summary, parent_key, time_spent, comment, url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.issueKey,
      input.summary,
      input.parentKey || null,
      input.timeSpent,
      input.comment || "",
      input.url || "",
      createdAt
    );

    db.prepare(
      `DELETE FROM recent_worklogs
       WHERE id NOT IN (
         SELECT id FROM recent_worklogs
         ORDER BY created_at DESC
         LIMIT ?
       )`
    ).run(MAX_RECENT);
  });

  tx();

  return {
    id,
    issueKey: input.issueKey,
    summary: input.summary,
    parentKey: input.parentKey,
    timeSpent: input.timeSpent,
    comment: input.comment || "",
    url: input.url || "",
    timestamp: createdAt,
  };
}

export function clearRecentWorklogs(): void {
  getDb().prepare("DELETE FROM recent_worklogs").run();
}

export function replaceRecentWorklogs(
  items: Array<{
    issueKey: string;
    summary: string;
    parentKey?: string;
    timeSpent: string;
    comment?: string;
    url?: string;
    timestamp?: string;
  }>
): RecentWorklog[] {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM recent_worklogs").run();
    const insert = db.prepare(
      `INSERT INTO recent_worklogs
       (id, issue_key, summary, parent_key, time_spent, comment, url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const item of items.slice(0, MAX_RECENT)) {
      insert.run(
        crypto.randomUUID(),
        item.issueKey,
        item.summary,
        item.parentKey || null,
        item.timeSpent,
        item.comment || "",
        item.url || "",
        item.timestamp || nowIso()
      );
    }
  });
  tx();
  return listRecentWorklogs();
}
