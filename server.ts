import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
