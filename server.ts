import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Lazy-initialized Gemini client with robust error checking
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment. Please add your Gemini API key in the AI Studio Secrets panel.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

// Helper to construct Jira API request options
interface JiraCredentials {
  url: string;
  authType: 'pat' | 'basic';
  token?: string;
  username?: string;
  password?: string;
}

function getJiraHeaders(creds: JiraCredentials): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  
  if (creds.authType === 'pat') {
    if (!creds.token) throw new Error("Personal Access Token (PAT) is required.");
    headers["Authorization"] = `Bearer ${creds.token.trim()}`;
  } else {
    if (!creds.username || !creds.password) {
      throw new Error("Username and Password are required for Basic auth.");
    }
    const encoded = Buffer.from(`${creds.username.trim()}:${creds.password.trim()}`).toString('base64');
    headers["Authorization"] = `Basic ${encoded}`;
  }
  
  return headers;
}

function normalizeJiraUrl(url: string): string {
  let cleaned = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = "https://" + cleaned;
  }
  return cleaned;
}

// ----------------- API ROUTES -----------------

// 1. Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. Test Connection
app.post("/api/jira/test", async (req, res) => {
  try {
    const creds: JiraCredentials = req.body;
    if (!creds || !creds.url) {
      return res.status(400).json({ error: "Jira URL is required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    // Call /rest/api/2/myself to validate auth & URL
    const response = await fetch(`${jiraUrl}/rest/api/2/myself`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Jira Server returned an error (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    return res.json({
      success: true,
      user: {
        name: data.name,
        displayName: data.displayName,
        emailAddress: data.emailAddress,
        active: data.active
      }
    });
  } catch (err: any) {
    console.error("Jira Test Connection Error:", err);
    return res.status(500).json({ 
      error: `Failed to connect to Jira Server: ${err.message}. Ensure the server is publicly accessible and correct credentials are used.` 
    });
  }
});

// 3. Fetch Projects
app.post("/api/jira/projects", async (req, res) => {
  try {
    const creds: JiraCredentials = req.body;
    if (!creds || !creds.url) {
      return res.status(400).json({ error: "Jira URL is required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const response = await fetch(`${jiraUrl}/rest/api/2/project`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Failed to fetch projects (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    // Map minimal project info
    const projects = data.map((p: any) => ({
      key: p.key,
      name: p.name,
      id: p.id
    }));

    return res.json({ success: true, projects });
  } catch (err: any) {
    console.error("Jira Projects Fetch Error:", err);
    return res.status(500).json({ error: `Failed to fetch projects: ${err.message}` });
  }
});

// 4. Fetch existing Epics
app.post("/api/jira/epics", async (req, res) => {
  try {
    const { creds, projectKey } = req.body;
    if (!creds || !creds.url || !projectKey) {
      return res.status(400).json({ error: "Jira URL and Project Key are required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    // Query epics using JQL search
    const jql = encodeURIComponent(`project = "${projectKey}" AND issuetype = "Epic"`);
    const searchUrl = `${jiraUrl}/rest/api/2/search?jql=${jql}&maxResults=100&fields=summary,key`;
    
    const response = await fetch(searchUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Failed to fetch epics (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    const epics = (data.issues || []).map((issue: any) => ({
      key: issue.key,
      summary: issue.fields?.summary || issue.key
    }));

    return res.json({ success: true, epics });
  } catch (err: any) {
    console.error("Jira Epics Fetch Error:", err);
    return res.status(500).json({ error: `Failed to fetch epics: ${err.message}` });
  }
});

// 4.5 Fetch project components
app.post("/api/jira/components", async (req, res) => {
  try {
    const { creds, projectKey } = req.body;
    if (!creds || !creds.url || !projectKey) {
      return res.status(400).json({ error: "Jira URL and Project Key are required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const response = await fetch(`${jiraUrl}/rest/api/2/project/${projectKey}/components`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Failed to fetch components (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    const components = (data || []).map((comp: any) => ({
      id: comp.id,
      name: comp.name,
      description: comp.description
    }));

    return res.json({ success: true, components });
  } catch (err: any) {
    console.error("Jira Components Fetch Error:", err);
    return res.status(500).json({ error: `Failed to fetch components: ${err.message}` });
  }
});

// 4.6 Fetch project assignable users
app.post("/api/jira/users", async (req, res) => {
  try {
    const { creds, projectKey } = req.body;
    if (!creds || !creds.url || !projectKey) {
      return res.status(400).json({ error: "Jira URL and Project Key are required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    // `/rest/api/2/user/assignable/search?project=${projectKey}` is the standard Jira Server endpoint
    const response = await fetch(`${jiraUrl}/rest/api/2/user/assignable/search?project=${projectKey.trim().toUpperCase()}&maxResults=100`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Failed to fetch users (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    const users = (data || []).map((u: any) => ({
      name: u.name, // unique username
      displayName: u.displayName,
      emailAddress: u.emailAddress,
      avatarUrls: u.avatarUrls
    }));

    return res.json({ success: true, users });
  } catch (err: any) {
    console.error("Jira Users Fetch Error:", err);
    return res.status(500).json({ error: `Failed to fetch assignable users: ${err.message}` });
  }
});

// 4.7 Fetch project releases / versions
app.post("/api/jira/versions", async (req, res) => {
  try {
    const { creds, projectKey } = req.body;
    if (!creds || !creds.url || !projectKey) {
      return res.status(400).json({ error: "Jira URL and Project Key are required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const response = await fetch(`${jiraUrl}/rest/api/2/project/${projectKey.trim().toUpperCase()}/versions`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Failed to fetch versions (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    const versions = (data || []).map((v: any) => ({
      id: v.id,
      name: v.name,
      released: v.released,
      startDate: v.startDate,
      releaseDate: v.releaseDate,
      description: v.description,
      archived: v.archived,
      overdue: v.overdue
    }));

    return res.json({ success: true, versions });
  } catch (err: any) {
    console.error("Jira Versions Fetch Error:", err);
    return res.status(500).json({ error: `Failed to fetch versions: ${err.message}` });
  }
});

// 4.7.1 Update version details (Dates, released state, description)
app.post("/api/jira/update-version", async (req, res) => {
  try {
    const { creds, versionId, updateData } = req.body;
    if (!creds || !creds.url || !versionId) {
      return res.status(400).json({ error: "Jira URL and Version ID are required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const response = await fetch(`${jiraUrl}/rest/api/2/version/${versionId}`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updateData)
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Failed to update version (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    return res.json({ success: true, version: data });
  } catch (err: any) {
    console.error("Jira Version Update Error:", err);
    return res.status(500).json({ error: `Failed to update version: ${err.message}` });
  }
});

// 4.8 Fetch project agile boards and sprints
app.post("/api/jira/sprints", async (req, res) => {
  try {
    const { creds, projectKey } = req.body;
    if (!creds || !creds.url || !projectKey) {
      return res.status(400).json({ error: "Jira URL and Project Key are required." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    // 1. Get scrum boards for this project
    const boardRes = await fetch(`${jiraUrl}/rest/agile/1.0/board?projectKeyOrId=${projectKey.trim().toUpperCase()}`, {
      method: "GET",
      headers,
    });

    if (!boardRes.ok) {
      console.warn(`Jira Agile Board API returned status ${boardRes.status}`);
      return res.json({ success: true, sprints: [] });
    }

    const boardData = await boardRes.json();
    const boards = boardData.values || [];
    const scrumBoards = boards.filter((b: any) => b.type === 'scrum');

    const sprints: any[] = [];
    const seenSprints = new Set<number>();

    // 2. Fetch active and future sprints for each scrum board
    for (const board of scrumBoards) {
      try {
        const sprintRes = await fetch(`${jiraUrl}/rest/agile/1.0/board/${board.id}/sprint?state=active,future`, {
          method: "GET",
          headers,
        });
        if (sprintRes.ok) {
          const sprintData = await sprintRes.json();
          const list = sprintData.values || [];
          for (const s of list) {
            if (!seenSprints.has(s.id)) {
              seenSprints.add(s.id);
              sprints.push({
                id: s.id,
                name: s.name,
                state: s.state,
                boardName: board.name
              });
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching sprints for board ${board.id}:`, e);
      }
    }

    return res.json({ success: true, sprints });
  } catch (err: any) {
    console.error("Jira Sprints Fetch Error:", err);
    return res.json({ success: true, sprints: [] });
  }
});

// Helper to convert Markdown to Jira Wiki Markup
function convertToJiraWikiMarkup(markdown: string): string {
  if (!markdown) return "";

  const lines = markdown.split(/\r?\n/);
  const convertedLines = lines.map(line => {
    // 1. Convert headers: e.g. "### Header" -> "h3. Header"
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      return `h${level}. ${headingMatch[2]}`;
    }

    // 2. Convert numbered list items: e.g. "1. text" or "۱. text" -> "# text"
    const numberedMatch = line.match(/^(\s*)(\d+|[\u06f0-\u06f9]+)[.)]\s+(.*)$/);
    if (numberedMatch) {
      return `${numberedMatch[1]}# ${numberedMatch[3]}`;
    }

    // 3. Convert normal bullet lists: e.g. "- text" -> "* text"
    const bulletMatch = line.match(/^(\s*)([-*+])\s+(.*)$/);
    if (bulletMatch) {
      return `${bulletMatch[1]}* ${bulletMatch[3]}`;
    }

    return line;
  });

  let text = convertedLines.join("\n");

  // 4. Convert bold text: "**text**" or "__text__" -> "*text*"
  text = text.replace(/\*\*(.*?)\*\*/g, "*$1*");
  text = text.replace(/__(.*?)__/g, "*$1*");

  return text;
}

// 5. Create Issue (Story, Epic, etc.)
app.post("/api/jira/create-issue", async (req, res) => {
  try {
    const { creds, projectKey, issue, config } = req.body;
    if (!creds || !creds.url || !projectKey || !issue) {
      return res.status(400).json({ error: "Missing required parameters." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const epicNameField = config?.epicNameField || "customfield_10008";
    const epicLinkField = config?.epicLinkField || "customfield_10014";

    const fields: Record<string, any> = {
      project: {
        key: projectKey.trim().toUpperCase()
      },
      summary: issue.summary,
      description: convertToJiraWikiMarkup(issue.description),
      issuetype: {
        name: issue.issuetype // "Story", "Epic", "Task" etc.
      },
      // Restrict labels strictly to 'agent' as requested
      labels: ["agent"]
    };

    // If a component is selected, attach it
    if (issue.selectedComponent) {
      fields.components = [{ name: issue.selectedComponent }];
    }

    // If a priority is selected, attach it
    if (issue.selectedPriority) {
      fields.priority = { name: issue.selectedPriority };
    }

    // If an assignee is selected, attach it
    if (issue.selectedAssignee) {
      fields.assignee = { name: issue.selectedAssignee };
    }

    // If a release is selected, attach it to fixVersions
    if (issue.selectedRelease) {
      const isId = /^\d+$/.test(issue.selectedRelease);
      fields.fixVersions = [isId ? { id: issue.selectedRelease } : { name: issue.selectedRelease }];
    }

    // If a sprint is selected (for Stories and Bugs), attach it to Sprint custom field
    if ((issue.issuetype === "Story" || issue.issuetype === "Bug") && issue.selectedSprint) {
      const sprintField = config?.sprintFieldId || "customfield_10010";
      const sprintIdNum = Number(issue.selectedSprint);
      if (!isNaN(sprintIdNum)) {
        fields[sprintField] = sprintIdNum;
      } else {
        fields[sprintField] = issue.selectedSprint;
      }
    }

    // If it is an Epic, Jira Server REST API v2 often requires an Epic Name custom field
    if (issue.issuetype === "Epic") {
      fields[epicNameField] = issue.summary; // Epic Name is usually just the summary
    }

    // If it is a Story or Bug and linked to an Epic
    if ((issue.issuetype === "Story" || issue.issuetype === "Bug") && issue.epicKey) {
      fields[epicLinkField] = issue.epicKey.trim();
    }

    // If it is a Sub-task and has a parent key
    if (issue.issuetype === "Sub-task" && issue.parentKey) {
      fields.parent = { key: issue.parentKey.trim().toUpperCase() };
    }

    const createUrl = `${jiraUrl}/rest/api/2/issue`;
    const response = await fetch(createUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const text = await response.text();
      let parsedError = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed.errors) {
          parsedError = Object.entries(parsed.errors).map(([k, v]) => `${k}: ${v}`).join(", ");
        } else if (parsed.errorMessages) {
          parsedError = parsed.errorMessages.join(", ");
        }
      } catch (e) {
        // use raw text
      }

      return res.status(response.status).json({ 
        error: `Jira returned an error (${response.status}): ${parsedError || response.statusText}`
      });
    }

    const data = await response.json();
    return res.json({
      success: true,
      key: data.key,
      id: data.id,
      self: data.self
    });
  } catch (err: any) {
    console.error("Jira Issue Creation Error:", err);
    return res.status(500).json({ error: `Failed to create issue in Jira: ${err.message}` });
  }
});

// Transition an issue to Done status
app.post("/api/jira/transition-to-done", async (req, res) => {
  try {
    const { creds, issueKey } = req.body;
    if (!creds || !creds.url || !issueKey) {
      return res.status(400).json({ error: "Missing required parameters (creds, issueKey)." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    // Step 1: Fetch available transitions
    const transitionsUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}/transitions`;
    const getResponse = await fetch(transitionsUrl, {
      method: "GET",
      headers
    });

    if (!getResponse.ok) {
      const text = await getResponse.text();
      return res.status(getResponse.status).json({
        error: `Failed to fetch transitions from Jira: ${text || getResponse.statusText}`
      });
    }

    const transitionData = await getResponse.json();
    const transitions = transitionData.transitions || [];

    // Step 2: Look for transition with name containing "done", "تکمیل", "بستن", "close", "resolve", "پایان"
    // Case-insensitive search
    const doneKeywords = ["done", "تکمیل", "بستن", "close", "resolve", "پایان", "تکمیل شده"];
    let selectedTransition = transitions.find((t: any) => {
      const name = (t.name || "").toLowerCase();
      const toName = (t.to?.name || "").toLowerCase();
      return doneKeywords.some(keyword => name.includes(keyword) || toName.includes(keyword));
    });

    // Fallback: If not found, look for any transition where destination category name is "Done"
    if (!selectedTransition) {
      selectedTransition = transitions.find((t: any) => {
        const category = (t.to?.statusCategory?.name || "").toLowerCase();
        return category === "done" || category === "complete";
      });
    }

    // Fallback 2: Just take any transition if there is one that matches commonly (e.g. status code or last transition)
    if (!selectedTransition) {
      return res.json({
        success: false,
        message: "No 'Done' transition found. Available transitions are: " + transitions.map((t: any) => t.name).join(", ")
      });
    }

    // Step 3: Post transition
    const postResponse = await fetch(transitionsUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        transition: {
          id: selectedTransition.id
        }
      })
    });

    if (!postResponse.ok) {
      const text = await postResponse.text();
      return res.status(postResponse.status).json({
        error: `Failed to execute transition to '${selectedTransition.name}' (${selectedTransition.id}): ${text || postResponse.statusText}`
      });
    }

    return res.json({
      success: true,
      transitionedTo: selectedTransition.name,
      transitionId: selectedTransition.id
    });

  } catch (err: any) {
    console.error("Jira Transition to Done Error:", err);
    return res.status(500).json({ error: `Failed to transition issue: ${err.message}` });
  }
});

app.post("/api/jira/update-issue", async (req, res) => {
  try {
    const { creds, issueKey, issue, config } = req.body;
    if (!creds || !creds.url || !issueKey || !issue) {
      return res.status(400).json({ error: "Missing required parameters." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const epicNameField = config?.epicNameField || "customfield_10008";
    const epicLinkField = config?.epicLinkField || "customfield_10014";

    const fields: Record<string, any> = {
      summary: issue.summary,
      description: convertToJiraWikiMarkup(issue.description),
    };

    // If a component is selected, attach it
    if (issue.selectedComponent !== undefined) {
      fields.components = issue.selectedComponent ? [{ name: issue.selectedComponent }] : [];
    }

    // If a priority is selected, attach it
    if (issue.selectedPriority) {
      fields.priority = { name: issue.selectedPriority };
    }

    // If an assignee is selected, attach it
    if (issue.selectedAssignee !== undefined) {
      fields.assignee = issue.selectedAssignee ? { name: issue.selectedAssignee } : null;
    }

    // If a release is selected, attach it to fixVersions
    if (issue.selectedRelease !== undefined) {
      if (issue.selectedRelease) {
        const isId = /^\d+$/.test(issue.selectedRelease);
        fields.fixVersions = [isId ? { id: issue.selectedRelease } : { name: issue.selectedRelease }];
      } else {
        fields.fixVersions = [];
      }
    }

    // If a sprint is selected (for Stories and Bugs), attach it to Sprint custom field
    if (issue.selectedSprint !== undefined) {
      const sprintField = config?.sprintFieldId || "customfield_10010";
      if (issue.selectedSprint) {
        const sprintIdNum = Number(issue.selectedSprint);
        if (!isNaN(sprintIdNum)) {
          fields[sprintField] = sprintIdNum;
        } else {
          fields[sprintField] = issue.selectedSprint;
        }
      } else {
        fields[sprintField] = null;
      }
    }

    // If it is an Epic, Jira Server REST API v2 often requires an Epic Name custom field
    if (issue.issuetype === "Epic") {
      fields[epicNameField] = issue.summary;
    }

    // If it is a Story or Bug and linked to an Epic
    if ((issue.issuetype === "Story" || issue.issuetype === "Bug") && issue.epicKey !== undefined) {
      fields[epicLinkField] = issue.epicKey ? issue.epicKey.trim() : null;
    }

    const updateUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}`;
    console.log(`[Jira Refiner Server] Updating issue ${issueKey} at ${updateUrl}`);
    const response = await fetch(updateUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const text = await response.text();
      let parsedError = text;
      try {
        const parsed = JSON.parse(text);
        if (parsed.errors) {
          parsedError = Object.entries(parsed.errors).map(([k, v]) => `${k}: ${v}`).join(", ");
        } else if (parsed.errorMessages) {
          parsedError = parsed.errorMessages.join(", ");
        }
      } catch (e) {
        // use raw text
      }

      return res.status(response.status).json({ 
        error: `Jira returned an error (${response.status}): ${parsedError || response.statusText}`
      });
    }

    return res.json({
      success: true,
      key: issueKey
    });
  } catch (err: any) {
    console.error("Jira Issue Update Error:", err);
    return res.status(500).json({ error: `Failed to update issue in Jira: ${err.message}` });
  }
});

// 6. Refine Drafts using Gemini
app.post("/api/refine", async (req, res) => {
  try {
    const { draftText, customPrompt, projectKey, model, outputMode } = req.body;
    if (!draftText) {
      return res.status(400).json({ error: "Draft stories / requirements text is required." });
    }

    const ai = getGeminiClient();

    let outputModeInstruction = "";
    if (outputMode === "epics") {
      outputModeInstruction = "\nCRITICAL REQUIREMENT: You MUST ONLY generate Epics. Do NOT generate any Stories or Bugs. Every single issue in the output array MUST have its 'issuetype' set to 'Epic'.";
    } else if (outputMode === "stories") {
      outputModeInstruction = "\nCRITICAL REQUIREMENT: You MUST ONLY generate Stories. Do NOT generate any Epics or Bugs. Every single issue in the output array MUST have its 'issuetype' set to 'Story'.";
    } else if (outputMode === "bugs") {
      outputModeInstruction = "\nCRITICAL REQUIREMENT: You MUST ONLY generate Bugs. Do NOT generate any Epics or Stories. Every single issue in the output array MUST have its 'issuetype' set to 'Bug'.";
    } else {
      outputModeInstruction = "\nGenerate Epics, Stories, and Bugs where appropriate based on the drafted requirements, and link Stories and Bugs to their corresponding Epics using 'epicReference'.";
    }

    const systemInstruction = `You are a professional Agile Product Owner and Business Analyst. Your task is to process the user's raw drafts, requirements, or bullet points of User Stories, Epics, and Bugs, clean them up, structure them beautifully, and output a structured JSON list.

Your output must follow the exact JSON schema provided.
${outputModeInstruction}

Key Rules:
1. Detect the user's primary language (especially if they draft in Persian/Farsi, or explicitly ask for Persian in the prompt). If they use Persian or request it, write the summary, description, and details in Persian (Farsi), but keep technical keys like issue type, labels, priorities, and ids in English.
2. Structure stories and bugs with a standard agile format:
   - For User Stories: 'As a... I want to... So that...' statement followed by descriptive body and Acceptance Criteria (Given/When/Then or checklists).
   - For Bugs: A clear 'Steps to Reproduce', 'Expected Result', and 'Actual Result' layout.
3. If the raw drafts describe some overarching goals, organize them into "Epic" issues, and make the individual requirements or issues "Story" or "Bug" issues.
4. If a Story or Bug belongs to a drafted Epic, set the 'epicReference' property to the exact 'id' of that drafted Epic (e.g., 'epic-1'). This is crucial so the user can easily link them later.
5. Provide relevant Agile labels/tags for each issue. No spaces in labels.
6. Suggest an appropriate priority from: 'Highest', 'High', 'Medium', 'Low', 'Lowest' (usually Medium is default, High/Highest for critical items, Low/Lowest for minor ones).
7. Suggest a relevant system component or module name (e.g., 'Frontend', 'Backend', 'Database', 'Auth', 'API', 'UI/UX', 'Billing', 'Mobile') in 'suggestedComponent'. Keep it concise.
8. The format of the description should use standard markdown or Jira wiki markup. Markdown is highly preferred. Make it neat and clean.`;

    const userPrompt = `Project Key: ${projectKey || "PROJ"}
Custom User Instructions/Prompt: ${customPrompt || "Clean up descriptions, structure with Acceptance Criteria, and make them professional."}

Raw Draft Content:
"""
${draftText}
"""`;

    // Map known models or pass directly. Supported: gemini-3.5-flash, gemini-3.1-flash-lite, gemini-3.1-pro-preview
    const selectedModel = model || "gemini-3.5-flash";
    const modelQueue = [selectedModel];
    if (selectedModel !== "gemini-3.5-flash") {
      modelQueue.push("gemini-3.5-flash");
    }
    if (!modelQueue.includes("gemini-3.1-flash-lite")) {
      modelQueue.push("gemini-3.1-flash-lite");
    }

    let lastError: any = null;
    let response: any = null;
    let successfulModel = "";

    for (const currentModel of modelQueue) {
      try {
        console.log(`[Jira Refiner Server] Attempting refinement with model: ${currentModel}`);
        response = await ai.models.generateContent({
          model: currentModel,
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.2, // Lower temperature for structured accuracy
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                issues: {
                  type: Type.ARRAY,
                  description: "Array of structured and refined Jira epics and stories.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: {
                        type: Type.STRING,
                        description: "Temporary ID for referencing (e.g., 'epic-1', 'story-1')."
                      },
                      summary: {
                        type: Type.STRING,
                        description: "Refined concise summary or title of the Jira ticket."
                      },
                      description: {
                        type: Type.STRING,
                        description: "The complete formatted description, including 'As a...', detail context, and Acceptance Criteria."
                      },
                      issuetype: {
                        type: Type.STRING,
                        description: "The issue type. Must be either 'Story', 'Epic', or 'Bug'."
                      },
                      epicReference: {
                        type: Type.STRING,
                        description: "If this is a Story or Bug that belongs to an Epic in this same array, set this to that Epic's temporary 'id' (e.g., 'epic-1'). Otherwise leave null."
                      },
                      suggestedLabels: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Suggested labels/tags for this Jira ticket. No spaces allowed in tags."
                      },
                      suggestedPriority: {
                        type: Type.STRING,
                        description: "Suggested agile priority. Must be one of: Highest, High, Medium, Low, Lowest."
                      },
                      suggestedComponent: {
                        type: Type.STRING,
                        description: "Suggested system component name (e.g., Backend, Frontend, UI/UX, Database, etc.)."
                      }
                    },
                    required: ["id", "summary", "description", "issuetype"]
                  }
                }
              },
              required: ["issues"]
            }
          }
        });
        
        if (response && response.text) {
          successfulModel = currentModel;
          break;
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`[Jira Refiner Server] Model ${currentModel} failed:`, e.message || e);
        // Try the next model in the fallback queue
      }
    }

    if (!response) {
      throw lastError || new Error("Failed to generate content with any model.");
    }

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response returned from the model.");
    }

    const data = JSON.parse(responseText);
    
    // Add info on which model was actually used for refinement
    data.refinedByModel = successfulModel;
    
    return res.json(data);
  } catch (err: any) {
    console.error("Gemini Refine Error:", err);
    return res.status(500).json({ error: `Refinement failed: ${err.message}` });
  }
});

app.post("/api/refine-single", async (req, res) => {
  try {
    const { summary, description, issuetype, customPrompt, draftText, model } = req.body;
    
    const ai = getGeminiClient();
    
    const selectedModel = model || "gemini-3.5-flash";
    const modelQueue = [selectedModel];
    if (selectedModel !== "gemini-3.5-flash") {
      modelQueue.push("gemini-3.5-flash");
    }
    if (selectedModel !== "gemini-3.1-flash-lite" && selectedModel !== "gemini-3.5-flash") {
      modelQueue.push("gemini-3.1-flash-lite");
    }

    const systemInstruction = `You are an expert Agile Product Owner and Business Analyst.
Your task is to REVISE or RE-REFINE an existing single Jira ticket (Summary, Description, and type: ${issuetype}) based on a custom instruction prompt provided by the user.

You should preserve the core of the original issue while addressing the user's custom instruction perfectly.
Output a JSON object containing the revised issue properties following the exact schema provided.

Key Rules:
1. Detect language (especially if Persian/Farsi is requested or used in the custom prompt). If they use Persian, write the summary and description in Persian, but keep priority names and issue types in English.
2. If it is a User Story: Use Agile standards (As a... I want to... So that...).
3. If it is a Bug: Provide Steps to Reproduce, Expected and Actual Results clearly formatted in Markdown.
4. If it is an Epic: Provide a structured high-level objective, scope, and key deliverables.`;

    const userPrompt = `
=== ORIGINAL BACKGROUND CONTEXT (Draft Requirements) ===
${draftText || "None"}

=== CURRENT TICKET INFO ===
Title/Summary: ${summary}
Issue Type: ${issuetype}
Current Description:
${description}

=== CUSTOM INSTRUCTION FOR RE-REFINEMENT ===
${customPrompt}

Please revise this ticket according to the custom instruction above.
`;

    let lastError: any = null;
    let response: any = null;
    let successfulModel = "";

    for (const currentModel of modelQueue) {
      try {
        console.log(`[Jira Refiner Server] Attempting single-issue refinement with model: ${currentModel}`);
        response = await ai.models.generateContent({
          model: currentModel,
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: {
                  type: Type.STRING,
                  description: "Revised concise summary or title of the Jira ticket."
                },
                description: {
                  type: Type.STRING,
                  description: "The complete revised formatted description."
                },
                suggestedLabels: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Revised labels/tags. No spaces allowed in tags."
                },
                suggestedPriority: {
                  type: Type.STRING,
                  description: "Revised priority (Highest, High, Medium, Low, Lowest)."
                },
                suggestedComponent: {
                  type: Type.STRING,
                  description: "Revised component name."
                }
              },
              required: ["summary", "description"]
            }
          }
        });
        
        if (response && response.text) {
          successfulModel = currentModel;
          break;
        }
      } catch (e: any) {
        lastError = e;
        console.warn(`[Jira Refiner Server] Model ${currentModel} failed in single refinement:`, e.message || e);
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error("Failed to generate content with any model.");
    }

    const data = JSON.parse(response.text);
    data.refinedByModel = successfulModel;
    return res.json(data);
  } catch (err: any) {
    console.error("Gemini Single Refine Error:", err);
    return res.status(500).json({ error: `Revision failed: ${err.message}` });
  }
});

app.post("/api/jira/fetch-issue", async (req, res) => {
  try {
    const { creds, issueKey } = req.body;
    if (!issueKey) {
      return res.status(400).json({ error: "issueKey is required." });
    }
    const headers = getJiraHeaders(creds);
    const jiraUrl = `${creds.url.replace(/\/$/, "")}/rest/api/2/issue/${issueKey}`;
    
    console.log(`[Jira Refiner Server] Fetching issue ${issueKey} from ${jiraUrl}`);
    const response = await fetch(jiraUrl, {
      method: "GET",
      headers,
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira returned status ${response.status}: ${text}`);
    }
    
    const data = await response.json();
    return res.json({
      success: true,
      issue: {
        key: data.key,
        summary: data.fields?.summary || "",
        description: data.fields?.description || "",
        issuetype: data.fields?.issuetype?.name || "Story",
        priority: data.fields?.priority?.name || "Medium",
        component: data.fields?.components?.[0]?.name || "",
        assignee: data.fields?.assignee?.name || "",
        status: data.fields?.status?.name || ""
      }
    });
  } catch (err: any) {
    console.error("Jira Fetch Issue Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Fetch active project issues for daily board
app.post("/api/jira/my-issues", async (req, res) => {
  try {
    const { creds, projectKey } = req.body;
    if (!creds || !creds.url || !projectKey) {
      return res.status(400).json({ error: "Missing required parameters (creds, projectKey)." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const jql = `project = '${projectKey.trim().toUpperCase()}' ORDER BY updated DESC`;
    const searchUrl = `${jiraUrl}/rest/api/2/search`;

    console.log(`[Jira Server] Fetching my issues with JQL: ${jql} at ${searchUrl}`);
    const response = await fetch(searchUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        jql,
        maxResults: 150,
        fields: [
          "summary", "description", "status", "priority", "assignee", 
          "issuetype", "timespent", "timeoriginalestimate", "worklog", "created"
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Jira search returned error (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    const issues = (data.issues || []).map((issue: any) => {
      const fields = issue.fields || {};
      const worklogData = fields.worklog?.worklogs || [];
      const worklogs = worklogData.map((wl: any) => ({
        id: wl.id,
        author: wl.author?.displayName || wl.author?.name || "Unknown",
        comment: wl.comment || "",
        timeSpent: wl.timeSpent || "",
        timeSpentSeconds: wl.timeSpentSeconds || 0,
        created: wl.created
      }));

      return {
        key: issue.key,
        id: issue.id,
        summary: fields.summary || "",
        description: fields.description || "",
        status: fields.status?.name || "Todo",
        priority: fields.priority?.name || "Medium",
        assignee: fields.assignee?.name || "",
        assigneeDisplayName: fields.assignee?.displayName || "",
        assigneeEmail: fields.assignee?.emailAddress || "",
        assigneeKey: fields.assignee?.key || "",
        issuetype: fields.issuetype?.name || "Story",
        timespent: fields.timespent || 0,
        timeoriginalestimate: fields.timeoriginalestimate || 0,
        worklogs,
        created: fields.created
      };
    });

    return res.json({ success: true, issues });
  } catch (err: any) {
    console.error("Jira My Issues Fetch Error:", err);
    return res.status(500).json({ error: `Failed to fetch issues: ${err.message}` });
  }
});

// Add worklog to a specific issue
app.post("/api/jira/worklog", async (req, res) => {
  try {
    const { creds, issueKey, timeSpent, comment, started } = req.body;
    if (!creds || !creds.url || !issueKey || !timeSpent) {
      return res.status(400).json({ error: "Missing required parameters (creds, issueKey, timeSpent)." });
    }

    const jiraUrl = normalizeJiraUrl(creds.url);
    const headers = getJiraHeaders(creds);

    const worklogUrl = `${jiraUrl}/rest/api/2/issue/${issueKey}/worklog`;
    console.log(`[Jira Server] Recording worklog for ${issueKey}: ${timeSpent} (${comment}) ${started ? `started at ${started}` : ''}`);

    const bodyData: Record<string, any> = {
      comment: comment || "",
      timeSpent: timeSpent
    };

    if (started) {
      // Jira REST API v2 often fails to parse standard ISO-8601 strings ending in 'Z'.
      // It expects the timezone offset in the format '+0000' or similar RFC 822 offset (e.g. yyyy-MM-dd'T'HH:mm:ss.SSSZ).
      let jiraStarted = started;
      if (typeof started === 'string') {
        if (started.endsWith('Z')) {
          jiraStarted = started.replace(/Z$/, "+0000");
        } else if (started.endsWith('+00:00')) {
          jiraStarted = started.replace(/\+00:00$/, "+0000");
        }
      }
      bodyData.started = jiraStarted;
    }

    const response = await fetch(worklogUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyData)
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ 
        error: `Jira returned an error (${response.status}): ${text || response.statusText}`
      });
    }

    const data = await response.json();
    return res.json({ success: true, worklog: data });
  } catch (err: any) {
    console.error("Jira Worklog Error:", err);
    return res.status(500).json({ error: `Failed to log work: ${err.message}` });
  }
});

// Generate AI Worklog plan matching user's daily prompt with Jira issues (proposing sub-tasks)
app.post("/api/jira/ai-worklog-plan", async (req, res) => {
  try {
    const { prompt, issues, language, model } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }
    if (!issues || !Array.isArray(issues)) {
      return res.status(400).json({ error: "An array of active issues is required." });
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are an intelligent agile work assistant.
The user has provided a natural language summary of their daily work.
You are also given a list of active Jira tickets for their project.

In our Agile development workflow, work logs (worklogs) must always be registered on a "Sub-task" of a parent issue (such as a Story, Bug, or Task), never directly on the parent.

Your task is to analyze the user's daily work description and plan a structured worklog proposal. For each distinct work activity described:
1. Identify if it matches an existing active parent ticket in the project (Stories, Bugs, or Tasks).
   - If there is an existing matching parent issue, set parentType = "existing" and parentKey = [matching issue key].
   - If there is some ambiguity or multiple possible parent matches, list up to 3 candidate keys in candidateParentKeys so the user can select.
   - If no existing ticket matches, propose creating a new parent Story. Set parentType = "new" and fill proposedParentStory with a logical summary and detailed Agile description (including Acceptance Criteria).
2. Propose creating a "Sub-task" under that parent issue for this user's specific daily contribution.
   - subTaskSummary: Write a concise, professional, action-oriented title (e.g. "Integrate registration OTP service" or "Develop UI for login button").
     * CRITICAL: DO NOT include the word "Sub-task", "Subtask", "subtask", "ساب‌تسک", "ساب تسک", or any similar prefix/suffix in the summary. The title must be just the action itself.
   - timeSpent: Generate the time spent formatted for JIRA (e.g., '1h 30m', '3h', '45m').
   - comment: Write a highly professional, detailed log comment describing what was achieved in this sub-task.
   - CRITICAL language rule: Write the subTaskSummary, proposedParentStory.summary/description, and the worklog comment in the same language as the user's prompt (usually Persian/Farsi if they wrote in Persian, or English if they wrote in English). Maintain standard agile professional terminology.

Your output must be a JSON object with a single 'proposals' array field containing the structured items.`;

    const issuesListText = issues.map(issue => 
      `Key: ${issue.key} | Summary: ${issue.summary} | Type: ${issue.issuetype} | Status: ${issue.status} | Assignee: ${issue.assigneeDisplayName || issue.assignee}`
    ).join("\n");

    const userPromptText = `Active Project Jira Tickets:
"""
${issuesListText}
"""

User's Daily Work Summary Prompt:
"""
${prompt}
"""`;

    const selectedModel = model || "gemini-3.5-flash";
    console.log(`[Jira Server AI Worklog] Generating Sub-task Plan using ${selectedModel}`);
    const aiResponse = await ai.models.generateContent({
      model: selectedModel,
      contents: userPromptText,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            proposals: {
              type: Type.ARRAY,
              description: "Structured proposals of parent Stories and Sub-tasks to be created and logged.",
              items: {
                type: Type.OBJECT,
                properties: {
                  parentType: {
                    type: Type.STRING,
                    enum: ["existing", "new"],
                    description: "Whether the parent of this subtask is an existing ticket or needs to be created."
                  },
                  parentKey: {
                    type: Type.STRING,
                    description: "The exact key of the matched existing JIRA issue (e.g., 'PROJ-123') or empty if parentType is 'new'."
                  },
                  candidateParentKeys: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Up to 3 alternative candidate issue keys if there's ambiguity."
                  },
                  proposedParentStory: {
                    type: Type.OBJECT,
                    description: "Details for creating a new parent Story if parentType is 'new'.",
                    properties: {
                      summary: { type: Type.STRING, description: "Title of the proposed Story" },
                      description: { type: Type.STRING, description: "Description and acceptance criteria of the proposed Story" }
                    },
                    required: ["summary", "description"]
                  },
                  subTaskSummary: {
                    type: Type.STRING,
                    description: "The summary for the new Sub-task to be created (e.g., 'Develop UI for login button'). NEVER include 'Sub-task', 'Subtask', 'subtask' or 'ساب‌تسک' in this summary."
                  },
                  timeSpent: {
                    type: Type.STRING,
                    description: "Jira-compatible time spent (e.g., '2h 15m')."
                  },
                  comment: {
                    type: Type.STRING,
                    description: "Detailed description of daily work done, to be logged as the worklog comment."
                  }
                },
                required: ["parentType", "subTaskSummary", "timeSpent", "comment"]
              }
            }
          },
          required: ["proposals"]
        }
      }
    });

    if (!aiResponse || !aiResponse.text) {
      throw new Error("No response from Gemini API.");
    }

    const data = JSON.parse(aiResponse.text);
    return res.json({ success: true, proposals: data.proposals || [] });
  } catch (err: any) {
    console.error("AI Worklog Plan Error:", err);
    return res.status(500).json({ error: `Failed to plan worklog: ${err.message}` });
  }
});

// ----------------- Mattermost Bot Webhook Integration -----------------

function cleanMattermostMessage(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  // Remove leading @username/botname mentions (e.g., @jira-bot, @bot)
  cleaned = cleaned.replace(/^@[a-zA-Z0-9_\-\u0600-\u06FF]+/i, "");
  return cleaned.trim();
}

function isPersian(text: string): boolean {
  const farsiRegex = /[\u0600-\u06FF]/;
  return farsiRegex.test(text);
}

app.post("/api/mattermost/webhook", async (req, res) => {
  try {
    const rawText = req.body.text || req.body.message || "";
    const user_name = req.body.user_name || req.body.sender_name || "User";
    const channel_id = req.body.channel_id || "";
    const post_id = req.body.post_id || req.body.id || "";

    console.log(`[Mattermost Webhook] Received message from ${user_name} in channel ${channel_id}: "${rawText}"`);

    if (!rawText.trim()) {
      return res.json({ text: "پیام خالی است. لطفاً متن یا پیش‌نویس نیازمندی خود را ارسال کنید." });
    }

    const draftText = cleanMattermostMessage(rawText);
    if (!draftText) {
      return res.json({ text: "لطفاً متن یا پیش‌نویس نیازمندی خود را بعد از منشن وارد کنید." });
    }

    const isFa = isPersian(draftText);

    // Send immediate acknowledgment to prevent Mattermost gateway timeout (5s)
    const ackMessage = isFa
      ? `سلام @${user_name} عزیز! در حال پردازش و استخراج داستان‌های کاربر (User Stories) با هوش مصنوعی جمینای هستم... لطفا چند لحظه منتظر بمانید. ⏳`
      : `Hello @${user_name}! I am processing and refining your requirements with Gemini AI... Please wait a moment. ⏳`;

    // Send HTTP 200 with the acknowledgment
    res.json({ text: ackMessage });

    // Process refinement asynchronously in the background
    (async () => {
      try {
        const ai = getGeminiClient();
        
        let outputModeInstruction = "\nGenerate Epics, Stories, and Bugs where appropriate based on the drafted requirements, and link Stories and Bugs to their corresponding Epics using 'epicReference'.";
        
        const systemInstruction = `You are a professional Agile Product Owner and Business Analyst. Your task is to process the user's raw drafts, requirements, or bullet points of User Stories, Epics, and Bugs, clean them up, structure them beautifully, and output a structured JSON list.

Your output must follow the exact JSON schema provided.
${outputModeInstruction}

Key Rules:
1. Detect the user's primary language (especially if they draft in Persian/Farsi, or explicitly ask for Persian in the prompt). If they use Persian or request it, write the summary, description, and details in Persian (Farsi), but keep technical keys like issue type, labels, priorities, and ids in English.
2. Structure stories and bugs with a standard agile format:
   - For User Stories: 'As a... I want to... So that...' statement followed by descriptive body and Acceptance Criteria (Given/When/Then or checklists).
   - For Bugs: A clear 'Steps to Reproduce', 'Expected Result', and 'Actual Result' layout.
3. If the raw drafts describe some overarching goals, organize them into "Epic" issues, and make the individual requirements or issues "Story" or "Bug" issues.
4. If a Story or Bug belongs to a drafted Epic, set the 'epicReference' property to the exact 'id' of that drafted Epic (e.g., 'epic-1'). This is crucial so the user can easily link them later.
5. Provide relevant Agile labels/tags for each issue. No spaces in labels.
6. Suggest an appropriate priority from: 'Highest', 'High', 'Medium', 'Low', 'Lowest' (usually Medium is default, High/Highest for critical items, Low/Lowest for minor ones).
7. Suggest a relevant system component or module name (e.g., 'Frontend', 'Backend', 'Database', 'Auth', 'API', 'UI/UX', 'Billing', 'Mobile') in 'suggestedComponent'. Keep it concise.
8. The format of the description should use standard markdown or Jira wiki markup. Markdown is highly preferred. Make it neat and clean.`;

        const userPrompt = `Project Key: "PROJ"
Custom User Instructions/Prompt: Clean up descriptions, structure with Acceptance Criteria, and make them professional.

Raw Draft Content:
"""
${draftText}
"""`;

        console.log(`[Mattermost Webhook Background] Calling Gemini model: gemini-3.5-flash`);
        const aiResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: userPrompt,
          config: {
            systemInstruction,
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                issues: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      summary: { type: Type.STRING },
                      description: { type: Type.STRING },
                      issuetype: { type: Type.STRING },
                      epicReference: { type: Type.STRING },
                      suggestedLabels: { type: Type.ARRAY, items: { type: Type.STRING } },
                      suggestedPriority: { type: Type.STRING },
                      suggestedComponent: { type: Type.STRING }
                    },
                    required: ["id", "summary", "description", "issuetype"]
                  }
                }
              },
              required: ["issues"]
            }
          }
        });

        if (!aiResponse || !aiResponse.text) {
          throw new Error("No response from Gemini API");
        }

        const data = JSON.parse(aiResponse.text);
        const issuesList = data.issues || [];
        console.log(`[Mattermost Webhook Background] Successfully refined ${issuesList.length} issues.`);

        // Check if Default Jira Server credentials are set in environment
        const defaultJiraUrl = process.env.JIRA_URL;
        const defaultJiraAuthType = process.env.JIRA_AUTH_TYPE || "pat";
        const defaultJiraToken = process.env.JIRA_TOKEN || process.env.JIRA_PAT;
        const defaultJiraUsername = process.env.JIRA_USERNAME;
        const defaultJiraPassword = process.env.JIRA_PASSWORD;
        const defaultJiraProject = process.env.JIRA_PROJECT || process.env.JIRA_DEFAULT_PROJECT || "PROJ";

        const jiraConfigured = !!(defaultJiraUrl && (defaultJiraToken || (defaultJiraUsername && defaultJiraPassword)));
        const createdIssues: Record<string, string> = {}; // temporary ID to Jira Key mapping

        if (jiraConfigured) {
          console.log(`[Mattermost Webhook Background] Default Jira configured. Attempting to auto-create issues...`);
          const jiraUrl = normalizeJiraUrl(defaultJiraUrl!);
          const creds: JiraCredentials = {
            url: jiraUrl,
            authType: defaultJiraAuthType as 'pat' | 'basic',
            token: defaultJiraToken,
            username: defaultJiraUsername,
            password: defaultJiraPassword
          };
          const headers = getJiraHeaders(creds);

          // We'll create Epics first so we can link Stories/Bugs to them
          // 1. Create Epics
          for (const issue of issuesList) {
            if (issue.issuetype === "Epic") {
              try {
                const fields: Record<string, any> = {
                  project: { key: defaultJiraProject.trim().toUpperCase() },
                  summary: issue.summary,
                  description: convertToJiraWikiMarkup(issue.description),
                  issuetype: { name: "Epic" },
                  labels: ["agent", "mattermost"],
                  customfield_10008: issue.summary // Epic Name field (standard default)
                };
                if (issue.suggestedPriority) fields.priority = { name: issue.suggestedPriority };
                if (issue.suggestedComponent) fields.components = [{ name: issue.suggestedComponent }];

                const response = await fetch(`${jiraUrl}/rest/api/2/issue`, {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ fields })
                });

                if (response.ok) {
                  const resData = await response.json();
                  createdIssues[issue.id] = resData.key;
                  console.log(`[Mattermost Webhook Background] Created Epic in Jira: ${resData.key}`);
                } else {
                  const errText = await response.text();
                  console.error(`[Mattermost Webhook Background] Failed to create Epic. Status: ${response.status}, Error: ${errText}`);
                }
              } catch (err) {
                console.error(`[Mattermost Webhook Background] Error creating Epic in Jira:`, err);
              }
            }
          }

          // 2. Create Stories & Bugs, linking to Epics if applicable
          for (const issue of issuesList) {
            if (issue.issuetype !== "Epic") {
              try {
                const fields: Record<string, any> = {
                  project: { key: defaultJiraProject.trim().toUpperCase() },
                  summary: issue.summary,
                  description: convertToJiraWikiMarkup(issue.description),
                  issuetype: { name: issue.issuetype },
                  labels: ["agent", "mattermost"]
                };
                if (issue.suggestedPriority) fields.priority = { name: issue.suggestedPriority };
                if (issue.suggestedComponent) fields.components = [{ name: issue.suggestedComponent }];

                // Check for Epic link via epicReference
                const parentEpicKey = issue.epicReference ? createdIssues[issue.epicReference] : null;
                if (parentEpicKey) {
                  fields.customfield_10014 = parentEpicKey; // Epic Link custom field (standard default)
                }

                const response = await fetch(`${jiraUrl}/rest/api/2/issue`, {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ fields })
                });

                if (response.ok) {
                  const resData = await response.json();
                  createdIssues[issue.id] = resData.key;
                  console.log(`[Mattermost Webhook Background] Created ${issue.issuetype} in Jira: ${resData.key}`);
                } else {
                  const errText = await response.text();
                  console.error(`[Mattermost Webhook Background] Failed to create ${issue.issuetype}. Status: ${response.status}, Error: ${errText}`);
                }
              } catch (err) {
                console.error(`[Mattermost Webhook Background] Error creating ${issue.issuetype} in Jira:`, err);
              }
            }
          }
        }

        // Build elegant Markdown presentation
        let responseMarkdown = "";
        if (isFa) {
          responseMarkdown += `### 🚀 تیکت‌های اصلاح‌شده با هوش مصنوعی جمینای\n\n`;
          responseMarkdown += `@${user_name} عزیز، نیازمندی‌های شما با موفقیت اصلاح و آماده‌سازی شدند:\n\n`;
        } else {
          responseMarkdown += `### 🚀 AI-Refined Agile Issues by Gemini\n\n`;
          responseMarkdown += `Hello @${user_name}, here are your refined issues based on your draft:\n\n`;
        }

        for (const issue of issuesList) {
          const createdKey = createdIssues[issue.id];
          let jiraInfo = "";
          if (createdKey && defaultJiraUrl) {
            const jiraLink = `${defaultJiraUrl.replace(/\/$/, "")}/browse/${createdKey}`;
            jiraInfo = isFa
              ? `🔗 **تیکت ایجاد شده در جیرا:** [${createdKey}](${jiraLink})\n`
              : `🔗 **Jira Ticket Created:** [${createdKey}](${jiraLink})\n`;
          }

          responseMarkdown += `--- \n\n`;
          responseMarkdown += `#### 📋 **[${issue.issuetype.toUpperCase()}]** **${issue.summary}**\n`;
          if (jiraInfo) responseMarkdown += jiraInfo;
          responseMarkdown += isFa 
            ? `* **اولویت:** \`${issue.suggestedPriority || 'Medium'}\`\n`
            : `* **Priority:** \`${issue.suggestedPriority || 'Medium'}\`\n`;
            
          if (issue.suggestedComponent) {
            responseMarkdown += isFa
              ? `* **کامپوننت:** \`${issue.suggestedComponent}\`\n`
              : `* **Component:** \`${issue.suggestedComponent}\`\n`;
          }
          if (issue.suggestedLabels && issue.suggestedLabels.length > 0) {
            responseMarkdown += isFa
              ? `* **برچسب‌ها:** ${issue.suggestedLabels.map((l: string) => `\`${l}\``).join(", ")}\n`
              : `* **Labels:** ${issue.suggestedLabels.map((l: string) => `\`${l}\``).join(", ")}\n`;
          }
          
          responseMarkdown += isFa
            ? `\n**توضیحات و سناریوها:**\n\n${issue.description}\n\n`
            : `\n**Description & Acceptance Criteria:**\n\n${issue.description}\n\n`;
        }

        // Post reply back to Mattermost
        const mmUrl = process.env.MATTERMOST_URL;
        const mmToken = process.env.MATTERMOST_BOT_TOKEN;

        if (mmUrl && mmToken && channel_id) {
          const postUrl = `${mmUrl.replace(/\/$/, "")}/api/v4/posts`;
          console.log(`[Mattermost Bot Webhook Background] Posting reply to channel ${channel_id}`);
          const body: Record<string, any> = {
            channel_id: channel_id,
            message: responseMarkdown
          };
          if (post_id) {
            body.root_id = post_id; // Threaded reply
          }

          const mmResponse = await fetch(postUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${mmToken.trim()}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          });

          if (!mmResponse.ok) {
            const text = await mmResponse.text();
            console.error(`[Mattermost Bot Webhook Background] Failed to post to Mattermost API. Status: ${mmResponse.status}, Error: ${text}`);
          } else {
            console.log(`[Mattermost Bot Webhook Background] Successfully posted refined issues to Mattermost.`);
          }
        } else {
          console.warn("[Mattermost Bot Webhook Background] Mattermost URL/Token or Channel ID missing. Outputting markdown to console:\n", responseMarkdown);
        }
      } catch (err: any) {
        console.error("[Mattermost Webhook Background Processing Error]:", err);
        // Try to report the error in Mattermost if possible
        const mmUrl = process.env.MATTERMOST_URL;
        const mmToken = process.env.MATTERMOST_BOT_TOKEN;
        if (mmUrl && mmToken && channel_id) {
          try {
            const errorReport = isFa
              ? `❌ خطایی در حین پردازش نیازمندی‌ها با هوش مصنوعی رخ داد:\n\`\`\`\n${err.message || err}\n\`\`\``
              : `❌ An error occurred during Gemini AI processing:\n\`\`\`\n${err.message || err}\n\`\`\``;
            
            await fetch(`${mmUrl.replace(/\/$/, "")}/api/v4/posts`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${mmToken.trim()}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                channel_id: channel_id,
                message: errorReport,
                root_id: post_id || undefined
              })
            });
          } catch (e) {
            console.error("Failed to post error message to Mattermost:", e);
          }
        }
      }
    })();

  } catch (err: any) {
    console.error("Mattermost Webhook Route Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ----------------- Mattermost Integration APIs -----------------

// Helper to get Mattermost headers
function getMattermostHeaders(token: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${token.trim()}`,
    "Content-Type": "application/json"
  };
}

// Route to test Mattermost bot connection
app.get("/api/mattermost/config", async (req, res) => {
  try {
    const url = process.env.MATTERMOST_URL || "";
    const hasToken = !!process.env.MATTERMOST_BOT_TOKEN;
    return res.json({
      url,
      hasToken,
      configured: !!(url && hasToken)
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/mattermost/test", async (req, res) => {
  try {
    const mmUrl = process.env.MATTERMOST_URL;
    const mmToken = process.env.MATTERMOST_BOT_TOKEN;

    if (!mmUrl || !mmToken) {
      return res.status(400).json({
        success: false,
        error: "Mattermost URL or Bot Token is missing in .env configurations."
      });
    }

    const cleanUrl = mmUrl.replace(/\/$/, "");
    
    // 1. Get Bot User Profile
    console.log(`[Mattermost Test] Querying user profile: ${cleanUrl}/api/v4/users/me`);
    const meResponse = await fetch(`${cleanUrl}/api/v4/users/me`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken)
    });

    if (!meResponse.ok) {
      const errText = await meResponse.text();
      return res.status(meResponse.status).json({
        success: false,
        error: `Failed to authenticate with Mattermost. Status: ${meResponse.status}, Response: ${errText}`
      });
    }

    const botUser = await meResponse.json();

    // 2. Get Teams the bot belongs to
    console.log(`[Mattermost Test] Querying bot teams: ${cleanUrl}/api/v4/users/me/teams`);
    const teamsResponse = await fetch(`${cleanUrl}/api/v4/users/me/teams`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken)
    });

    let teams = [];
    if (teamsResponse.ok) {
      teams = await teamsResponse.json();
    }

    // 3. Get Channels the bot belongs to
    console.log(`[Mattermost Test] Querying bot channels: ${cleanUrl}/api/v4/users/me/channels`);
    const channelsResponse = await fetch(`${cleanUrl}/api/v4/users/me/channels`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken)
    });

    let channels = [];
    if (channelsResponse.ok) {
      channels = await channelsResponse.json();
    }

    return res.json({
      success: true,
      botUser,
      teams,
      channelsCount: channels.length,
      config: {
        url: cleanUrl
      }
    });

  } catch (err: any) {
    console.error("[Mattermost Test Connection Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred while connecting to Mattermost."
    });
  }
});

// Route to fetch recent drafts/messages from Mattermost channels
app.post("/api/mattermost/drafts", async (req, res) => {
  try {
    const mmUrl = process.env.MATTERMOST_URL;
    const mmToken = process.env.MATTERMOST_BOT_TOKEN;

    if (!mmUrl || !mmToken) {
      return res.status(400).json({
        success: false,
        error: "Mattermost URL or Bot Token is missing in .env configurations."
      });
    }

    const cleanUrl = mmUrl.replace(/\/$/, "");

    // 1. Get bot profile to know bot username & id (for self-filtering & mention detection)
    const meResponse = await fetch(`${cleanUrl}/api/v4/users/me`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken)
    });

    if (!meResponse.ok) {
      const errText = await meResponse.text();
      return res.status(meResponse.status).json({
        success: false,
        error: `Authentication failed. Status: ${meResponse.status}, Error: ${errText}`
      });
    }

    const botUser = await meResponse.json();
    const botId = botUser.id;
    const botUsername = botUser.username;

    // 2. Get bot channels
    const channelsResponse = await fetch(`${cleanUrl}/api/v4/users/me/channels`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken)
    });

    if (!channelsResponse.ok) {
      return res.status(channelsResponse.status).json({
        success: false,
        error: `Failed to load channels. Status: ${channelsResponse.status}`
      });
    }

    const channels = await channelsResponse.json();
    if (!channels || channels.length === 0) {
      return res.json({
        success: true,
        drafts: [],
        message: "No channels found for this bot. Invite the bot to a channel first."
      });
    }

    // 3. For each channel, fetch recent posts
    const allPosts: any[] = [];
    const channelMap: Record<string, string> = {};
    const userIdsSet = new Set<string>();

    for (const channel of channels) {
      channelMap[channel.id] = channel.display_name || channel.name;

      try {
        const postsResponse = await fetch(`${cleanUrl}/api/v4/channels/${channel.id}/posts?page=0&per_page=20`, {
          method: "GET",
          headers: getMattermostHeaders(mmToken)
        });

        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          const postsObj = postsData.posts || {};
          const order = postsData.order || [];

          for (const postId of order) {
            const post = postsObj[postId];
            if (post && post.user_id !== botId) { // Exclude bot's own messages
              allPosts.push({
                id: post.id,
                channelId: post.channel_id,
                channelName: channelMap[post.channel_id],
                message: post.message || "",
                userId: post.user_id,
                createdAt: post.create_at || 0
              });
              userIdsSet.add(post.user_id);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to fetch posts for channel ${channel.id}:`, err);
      }
    }

    // 4. Batch lookup user profiles for usernames
    const userMap: Record<string, string> = {};
    const userIdsList = Array.from(userIdsSet);
    if (userIdsList.length > 0) {
      try {
        const usersResponse = await fetch(`${cleanUrl}/api/v4/users/ids`, {
          method: "POST",
          headers: getMattermostHeaders(mmToken),
          body: JSON.stringify(userIdsList)
        });

        if (usersResponse.ok) {
          const usersList = await usersResponse.json();
          for (const user of usersList) {
            userMap[user.id] = user.nickname || user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : `@${user.username}`;
          }
        }
      } catch (err) {
        console.error("Failed to batch lookup users:", err);
      }
    }

    // 5. Build final list of drafts
    const finalDrafts = allPosts.map(post => {
      const msg = post.message.trim();
      const isMention = msg.includes(`@${botUsername}`) || msg.includes(`<@${botId}>`);
      const cleaned = cleanMattermostMessage(msg);

      return {
        id: post.id,
        channelId: post.channelId,
        channelName: post.channelName,
        rawText: msg,
        cleanedText: cleaned,
        userId: post.userId,
        senderName: userMap[post.userId] || `User (${post.userId.substring(0, 5)})`,
        createdAt: post.createdAt,
        isMention
      };
    });

    // Sort newest first
    finalDrafts.sort((a, b) => b.createdAt - a.createdAt);

    return res.json({
      success: true,
      botUsername,
      drafts: finalDrafts
    });

  } catch (err: any) {
    console.error("[Mattermost Get Drafts Error]:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "An unexpected error occurred while loading drafts."
    });
  }
});

// ----------------------------------------------

// Vite and Asset serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static assets in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Jira Refiner Server] running on http://localhost:${PORT}`);
  });
}

startServer();
