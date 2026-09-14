import type { StoryLens } from "@/lib/lens";

export interface OpsIssue {
  key: string;
  id: string;
  summary: string;
  issuetype: string;
  status: string;
  statusCategoryKey?: string;
  priority?: string;
  assignee?: string;
  assigneeDisplayName?: string;
  components: string[];
  lens?: StoryLens;
  epicKey?: string;
  /** Immediate parent when this is a sub-task. */
  parentKey?: string;
  isSubtask?: boolean;
  fixVersionIds: string[];
  fixVersionNames: string[];
  /** True when this issue should own Fix Version itself. */
  ownsFixVersion: boolean;
  /** Display version: own when owner, inherited from epic when child. */
  effectiveFixVersionId?: string;
  effectiveFixVersionName?: string;
  /** When effective version comes from epic. */
  effectiveFixVersionFromEpic?: boolean;
}

export type OpsFilterValues = {
  backlog: string;
  type: string;
  status: string;
  /** Fix Version id, ALL, or NONE (no owned release). */
  version: string;
  q: string;
};


export type BulkActionId =
  | "setLens"
  | "setAssignee"
  | "setFixVersion"
  | "setStatus";

export type BulkActionResult = {
  issueKey: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
};
