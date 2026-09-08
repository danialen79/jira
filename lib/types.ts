import type { StoryLens } from "@/lib/lens";

export type { StoryLens };

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
  /** Story origin lens; stored in Jira as lens-* label. */
  selectedLens?: StoryLens;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "future" | "closed";
  boardName?: string;
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
  /** Parsed from lens-* Jira labels. */
  lens?: StoryLens;
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
