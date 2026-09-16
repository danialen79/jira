import type { IssueLens, StoryLens } from "@/lib/lens";

export type { IssueLens, StoryLens };

export interface JiraCredentials {
  url: string;
  authType: "pat" | "basic";
  token?: string;
  username?: string;
  password?: string;
}

export interface RefinedIssue {
  id: string;
  summary: string;
  description: string;
  issuetype: "Story" | "Epic" | "Bug";
  epicReference?: string;
  suggestedLabels?: string[];
  suggestedPriority?: string;
  suggestedComponent?: string;
  status: "draft" | "creating" | "success" | "failed";
  createdKey?: string;
  error?: string;
  selectedEpicKey?: string;
  selectedComponent?: string;
  selectedAssignee?: string;
  selectedSprint?: string;
  selectedRelease?: string;
  selectedPriority?: string;
  /** Origin lens; stored in Jira as lens-* label. Stories: 4 lenses; Epics may use mixed. */
  selectedLens?: IssueLens;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "future" | "closed";
  boardName?: string;
  boardId?: number;
  goal?: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface SprintIssue {
  key: string;
  id: string;
  summary: string;
  status: string;
  statusCategoryKey?: string;
  issuetype: string;
  priority?: string;
  assignee?: string;
  assigneeDisplayName?: string;
  timeoriginalestimate?: number;
  timeestimate?: number;
  timespent?: number;
  /** Parent story/task key when this is a sub-task. */
  parentKey?: string;
  parentSummary?: string;
  isSubtask?: boolean;
  children?: SprintIssue[];
  /** True when this row is a placeholder for a parent not in the sprint. */
  placeholder?: boolean;
}

export interface JiraVersion {
  id: string;
  name: string;
  released?: boolean;
  startDate?: string;
  releaseDate?: string;
  description?: string;
  archived?: boolean;
  overdue?: boolean;
}

export interface VersionIssue {
  key: string;
  id: string;
  summary: string;
  status: string;
  statusCategoryKey?: string;
  issuetype: string;
  priority?: string;
  assignee?: string;
  assigneeDisplayName?: string;
  components: string[];
  /** Parsed from lens-* Jira labels (includes epic mixed). */
  lens?: IssueLens;
  /** Epic this issue belongs to (Epic Link / parent epic). */
  epicKey?: string;
  /** Immediate parent issue key (sub-task parent). */
  parentKey?: string;
  /** False when shown as epic child but not on this Fix Version. */
  inVersion?: boolean;
  children?: VersionIssue[];
}

export interface VersionProgressSummary {
  todo: number;
  inProgress: number;
  done: number;
  canceled: number;
  percent: number;
  activeTotal: number;
}

export interface JiraUser {
  name: string;
  displayName: string;
  emailAddress?: string;
  avatarUrls?: { [key: string]: string };
}

export interface JiraProject {
  key: string;
  name: string;
  id: string;
}

export interface JiraEpic {
  key: string;
  summary: string;
}

export interface JiraComponent {
  id: string;
  name: string;
  description?: string;
}

export interface ConnectionConfig {
  epicNameField: string;
  epicLinkField: string;
  sprintFieldId?: string;
}

export type Language = "en" | "fa";

export interface EpicAuditChildIssue {
  key: string;
  summary: string;
  issuetype: string;
  status: string;
  components: string[];
  missingComponents: string[];
}

export interface EpicAuditItem {
  key: string;
  summary: string;
  components: string[];
  status?: string;
  childIssues: EpicAuditChildIssue[];
}
