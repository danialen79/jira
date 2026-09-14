export interface DailyWorklog {
  id: string;
  author: string;
  comment: string;
  timeSpent: string;
  timeSpentSeconds: number;
  created: string;
}

export interface DailyBoardIssue {
  key: string;
  id: string;
  summary: string;
  description: string;
  status: string;
  statusCategory: string;
  priority: string;
  assignee: string;
  assigneeDisplayName: string;
  assigneeEmail?: string;
  assigneeKey?: string;
  issuetype: string;
  parentKey?: string;
  timespent: number;
  timeoriginalestimate: number;
  worklogs: DailyWorklog[];
  created: string;
  /** Count of matching sub-tasks rolled into this parent (display only). */
  rolledUpSubtaskCount?: number;
}

export interface WorklogChip {
  key: string;
  summary: string;
}

/** Column definition from Jira board configuration (Product board). */
export interface BoardColumnDef {
  name: string;
  category: string;
  /** Jira status names mapped into this board column. */
  statusNames: string[];
  /**
   * Preferred Jira status when dropping onto this column
   * (column name match, else first mapped status).
   */
  dropStatusName: string | null;
}

export interface KanbanColumn {
  /** Board column name (DnD id / display). */
  status: string;
  category: string;
  issues: DailyBoardIssue[];
  statusNames: string[];
  dropStatusName: string | null;
}

export interface RecentLogItem {
  issueKey: string;
  summary: string;
  parentKey?: string;
  timeSpent: string;
  comment: string;
  timestamp: string;
  url: string;
}

export interface AIWorklogPlanItem {
  id: string;
  parentType: "existing" | "new";
  parentKey?: string;
  candidateParentKeys?: string[];
  proposedParentStory?: {
    summary: string;
    description: string;
  };
  subTaskSummary: string;
  timeSpent: string;
  comment: string;
  started?: string;
  selected?: boolean;
  status?:
    | "pending"
    | "logging"
    | "success"
    | "failed";
  error?: string;
}
