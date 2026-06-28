export interface JiraCredentials {
  url: string;
  authType: 'pat' | 'basic';
  token?: string;
  username?: string;
  password?: string;
}

export interface RefinedIssue {
  id: string; // Temporary ID like 'epic-1', 'story-1'
  summary: string;
  description: string;
  issuetype: 'Story' | 'Epic' | 'Bug';
  epicReference?: string; // Links to temporary id of Epic in same list
  suggestedLabels?: string[];
  suggestedPriority?: string;
  suggestedComponent?: string;
  
  // UI and Lifecycle states
  status: 'draft' | 'creating' | 'success' | 'failed';
  createdKey?: string; // Resulting Jira Issue Key, e.g., 'PROJ-123'
  error?: string;
  
  // Custom manual epic link override (e.g., linked to existing epic)
  selectedEpicKey?: string;
  selectedComponent?: string; // Selected component name
  selectedAssignee?: string; // Selected assignee username
  selectedSprint?: string; // Selected sprint ID/name (for Stories)
  selectedRelease?: string; // Selected release (fixVersions) name/ID (for Epics)
  selectedPriority?: string; // Selected priority name
}

export interface JiraSprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed';
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

export interface JiraUser {
  name: string; // Jira Username (used for assignment)
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
  epicNameField: string; // usually customfield_10008 (Epic Name in Jira Server)
  epicLinkField: string; // usually customfield_10014 or customfield_10000 (Epic Link in Jira Server)
  sprintFieldId?: string; // Sprint custom field ID, e.g. customfield_10010
}

export type Language = 'en' | 'fa';
