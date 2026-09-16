import { GoogleGenAI, Type } from "@google/genai";

export function getGeminiClient(apiKeyOverride?: string) {
  const apiKey = apiKeyOverride?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not defined in the environment. Please add your Gemini API key in the AI Studio Secrets panel."
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export function getOutputModeInstruction(outputMode?: string): string {
  if (outputMode === "epics") {
    return "\nCRITICAL REQUIREMENT: You MUST ONLY generate Epics. Do NOT generate any Stories or Bugs. Every single issue in the output array MUST have its 'issuetype' set to 'Epic'.";
  } else if (outputMode === "stories") {
    return "\nCRITICAL REQUIREMENT: You MUST ONLY generate Stories. Do NOT generate any Epics or Bugs. Every single issue in the output array MUST have its 'issuetype' set to 'Story'.";
  } else if (outputMode === "bugs") {
    return "\nCRITICAL REQUIREMENT: You MUST ONLY generate Bugs. Do NOT generate any Epics or Stories. Every single issue in the output array MUST have its 'issuetype' set to 'Bug'.";
  }
  return "\nGenerate Epics, Stories, and Bugs where appropriate based on the drafted requirements, and link Stories and Bugs to their corresponding Epics using 'epicReference'.";
}

export function getRefineSystemInstruction(outputModeInstruction: string): string {
  return `You are a professional Agile Product Owner and Business Analyst. Your task is to process the user's raw drafts, requirements, or bullet points of User Stories, Epics, and Bugs, clean them up, structure them beautifully, and output a structured JSON list.

Your output must follow the exact JSON schema provided.
${outputModeInstruction}

CRITICAL RULES FOR LANGUAGE & FORMATTING:
1. LANGUAGE AND TERMINOLOGY:
   - Always write all ticket summaries, descriptions, titles, and details in fluent, natural, smooth Persian (Farsi).
   - Technical and specialized terms (such as 'API', 'OpenAI', 'Timeout', 'Rate Limit', '5xx', '4xx', 'OAuth', 'JWT', 'Database', 'Frontend', 'Backend', 'JSON', etc.) MUST remain strictly in English.
2. NO MARKDOWN OR JIRA WIKI FORMATTING SYMBOLS:
   - Do NOT use Jira wiki headers like 'h3.', 'h2.', 'h1.'.
   - Do NOT use asterisks for bold or italics (do NOT write *word*, **word**, or _word_).
   - Do NOT use checkbox syntax like '* [ ]' or '[ ]'.
   - Do NOT insert meaningless markup characters or symbols anywhere in the summary or description.
   - Use clean, plain-text line breaks and simple plain titles (e.g., 'داستان کاربر:' or 'معیارهای پذیرش:' or 'مراحل بازتولید:') on their own lines without any asterisks or h3. tags.
3. AGILE / SCRUM STANDARD STRUCTURE (In Fluent Persian):
   - For User Stories: Use standard Scrum structure:
     داستان کاربر:
     به عنوان [نقش]
     می‌خواهم [قابلیت / نیاز]
     تا اینکه [هدف / ارزش افزوده]

     معیارهای پذیرش:
     - [معیار 1]
     - [معیار 2]
   - For Bugs: Use clean Persian bug layout:
     مراحل بازتولید:
     1. [مرحله 1]
     2. [مرحله 2]

     نتیجه مورد انتظار:
     [توضیح]

     نتیجه فعلی:
     [توضیح]
   - For Epics:
     هدف کلی:
     [توضیح]

     دامنه و خروجی‌های کلیدی:
     - [مورد 1]
4. Suggest priority from: 'Highest', 'High', 'Medium', 'Low', 'Lowest'.
5. Suggest a concise system component name (e.g. 'Frontend', 'Backend', 'Database', 'Auth', 'API').
6. Do NOT suggest free-form labels/tags. Labels are applied by the system (agent + lens only).`;
}

/** Slightly shorter system instruction used by Mattermost webhook (matches server.ts wording). */
export function getMattermostRefineSystemInstruction(outputModeInstruction: string): string {
  return `You are a professional Agile Product Owner and Business Analyst. Your task is to process the user's raw drafts, requirements, or bullet points of User Stories, Epics, and Bugs, clean them up, structure them, and output a structured JSON list.

Your output must follow the exact JSON schema provided.
${outputModeInstruction}

CRITICAL RULES FOR LANGUAGE & FORMATTING:
1. LANGUAGE AND TERMINOLOGY:
   - Always write all ticket summaries, descriptions, titles, and details in fluent, natural, smooth Persian (Farsi).
   - Technical and specialized terms (such as 'API', 'OpenAI', 'Timeout', 'Rate Limit', '5xx', '4xx', 'OAuth', 'JWT', 'Database', 'Frontend', 'Backend', 'JSON', etc.) MUST remain strictly in English.
2. NO MARKDOWN OR JIRA WIKI FORMATTING SYMBOLS:
   - Do NOT use Jira wiki headers like 'h3.', 'h2.', 'h1.'.
   - Do NOT use asterisks for bold or italics (do NOT write *word*, **word**, or _word_).
   - Do NOT use checkbox syntax like '* [ ]' or '[ ]'.
   - Do NOT insert meaningless markup characters or symbols anywhere in the summary or description.
   - Use clean, plain-text line breaks and simple plain titles (e.g., 'داستان کاربر:' or 'معیارهای پذیرش:' or 'مراحل بازتولید:') on their own lines without any asterisks or h3. tags.
3. AGILE / SCRUM STANDARD STRUCTURE (In Fluent Persian):
   - For User Stories: Use standard Scrum structure:
     داستان کاربر:
     به عنوان [نقش]
     می‌خواهم [قابلیت / نیاز]
     تا اینکه [هدف / ارزش افزوده]

     معیارهای پذیرش:
     - [معیار 1]
     - [معیار 2]
   - For Bugs: Use clean Persian bug layout:
     مراحل بازتولید:
     1. [مرحله 1]
     2. [مرحله 2]

     نتیجه مورد انتظار:
     [توضیح]

     نتیجه فعلی:
     [توضیح]
   - For Epics:
     هدف کلی:
     [توضیح]

     دامنه و خروجی‌های کلیدی:
     - [مورد 1]
4. Suggest priority from: 'Highest', 'High', 'Medium', 'Low', 'Lowest'.
5. Suggest a concise system component name (e.g. 'Frontend', 'Backend', 'Database', 'Auth', 'API').
6. Do NOT suggest free-form labels/tags. Labels are applied by the system (agent + lens only).`;
}

export function getRefineSingleSystemInstruction(issuetype: string): string {
  return `You are an expert Agile Product Owner and Business Analyst.
Your task is to REVISE or RE-REFINE an existing single Jira ticket (Summary, Description, and type: ${issuetype}) based on a custom instruction prompt provided by the user.

CRITICAL RULES FOR LANGUAGE & FORMATTING:
1. LANGUAGE AND TERMINOLOGY:
   - Always write all ticket summaries, descriptions, titles, and details in fluent, natural, smooth Persian (Farsi).
   - Technical and specialized terms (such as 'API', 'OpenAI', 'Timeout', 'Rate Limit', '5xx', '4xx', 'OAuth', 'JWT', 'Database', 'Frontend', 'Backend', 'JSON', etc.) MUST remain strictly in English.
2. NO MARKDOWN OR JIRA WIKI FORMATTING SYMBOLS:
   - Do NOT use Jira wiki headers like 'h3.', 'h2.', 'h1.'.
   - Do NOT use asterisks for bold or italics (do NOT write *word*, **word**, or _word_).
   - Do NOT use checkbox syntax like '* [ ]' or '[ ]'.
   - Do NOT insert meaningless markup characters or formatting symbols anywhere in the summary or description.
   - Use clean, plain-text line breaks and simple plain titles (e.g., 'داستان کاربر:' or 'معیارهای پذیرش:' or 'مراحل بازتولید:') on their own lines without any asterisks or h3. tags.
3. Preserve the core intent of the original issue while addressing the user's custom instruction perfectly.`;
}

export const AI_WORKLOG_SYSTEM_INSTRUCTION = `You are an intelligent agile work assistant.
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

export const refineIssuesResponseSchema = {
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
            description: "Temporary ID for referencing (e.g., 'epic-1', 'story-1').",
          },
          summary: {
            type: Type.STRING,
            description: "Refined concise summary or title of the Jira ticket.",
          },
          description: {
            type: Type.STRING,
            description:
              "The complete formatted description, including 'As a...', detail context, and Acceptance Criteria.",
          },
          issuetype: {
            type: Type.STRING,
            description: "The issue type. Must be either 'Story', 'Epic', or 'Bug'.",
          },
          epicReference: {
            type: Type.STRING,
            description:
              "If this is a Story or Bug that belongs to an Epic in this same array, set this to that Epic's temporary 'id' (e.g., 'epic-1'). Otherwise leave null.",
          },
          suggestedPriority: {
            type: Type.STRING,
            description:
              "Suggested agile priority. Must be one of: Highest, High, Medium, Low, Lowest.",
          },
          suggestedComponent: {
            type: Type.STRING,
            description:
              "Suggested system component name (e.g., Backend, Frontend, UI/UX, Database, etc.).",
          },
        },
        required: ["id", "summary", "description", "issuetype"],
      },
    },
  },
  required: ["issues"],
};

export const refineSingleResponseSchema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Revised concise summary or title of the Jira ticket.",
    },
    description: {
      type: Type.STRING,
      description: "The complete revised formatted description.",
    },
    suggestedPriority: {
      type: Type.STRING,
      description: "Revised priority (Highest, High, Medium, Low, Lowest).",
    },
    suggestedComponent: {
      type: Type.STRING,
      description: "Revised component name.",
    },
  },
  required: ["summary", "description"],
};

export const aiWorklogResponseSchema = {
  type: Type.OBJECT,
  properties: {
    proposals: {
      type: Type.ARRAY,
      description:
        "Structured proposals of parent Stories and Sub-tasks to be created and logged.",
      items: {
        type: Type.OBJECT,
        properties: {
          parentType: {
            type: Type.STRING,
            enum: ["existing", "new"],
            description:
              "Whether the parent of this subtask is an existing ticket or needs to be created.",
          },
          parentKey: {
            type: Type.STRING,
            description:
              "The exact key of the matched existing JIRA issue (e.g., 'PROJ-123') or empty if parentType is 'new'.",
          },
          candidateParentKeys: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Up to 3 alternative candidate issue keys if there's ambiguity.",
          },
          proposedParentStory: {
            type: Type.OBJECT,
            description: "Details for creating a new parent Story if parentType is 'new'.",
            properties: {
              summary: { type: Type.STRING, description: "Title of the proposed Story" },
              description: {
                type: Type.STRING,
                description: "Description and acceptance criteria of the proposed Story",
              },
            },
            required: ["summary", "description"],
          },
          subTaskSummary: {
            type: Type.STRING,
            description:
              "The summary for the new Sub-task to be created (e.g., 'Develop UI for login button'). NEVER include 'Sub-task', 'Subtask', 'subtask' or 'ساب‌تسک' in this summary.",
          },
          timeSpent: {
            type: Type.STRING,
            description: "Jira-compatible time spent (e.g., '2h 15m').",
          },
          comment: {
            type: Type.STRING,
            description:
              "Detailed description of daily work done, to be logged as the worklog comment.",
          },
        },
        required: ["parentType", "subTaskSummary", "timeSpent", "comment"],
      },
    },
  },
  required: ["proposals"],
};

/** Compact schema used by Mattermost webhook (matches server.ts). */
export const mattermostRefineResponseSchema = {
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
          suggestedPriority: { type: Type.STRING },
          suggestedComponent: { type: Type.STRING },
        },
        required: ["id", "summary", "description", "issuetype"],
      },
    },
  },
  required: ["issues"],
};

export function buildRefineModelQueue(model?: string): string[] {
  const selectedModel = model || "gemini-3.5-flash";
  const modelQueue = [selectedModel];
  if (selectedModel !== "gemini-3.5-flash") {
    modelQueue.push("gemini-3.5-flash");
  }
  if (!modelQueue.includes("gemini-3.1-flash-lite")) {
    modelQueue.push("gemini-3.1-flash-lite");
  }
  return modelQueue;
}

export function buildRefineSingleModelQueue(model?: string): string[] {
  const selectedModel = model || "gemini-3.5-flash";
  const modelQueue = [selectedModel];
  if (selectedModel !== "gemini-3.5-flash") {
    modelQueue.push("gemini-3.5-flash");
  }
  if (selectedModel !== "gemini-3.1-flash-lite" && selectedModel !== "gemini-3.5-flash") {
    modelQueue.push("gemini-3.1-flash-lite");
  }
  return modelQueue;
}
