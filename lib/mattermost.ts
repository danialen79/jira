import {
  convertToJiraWikiMarkup,
  getJiraClient,
  sanitizeJiraText,
} from "@/lib/jira";
import {
  getMattermostRefineSystemInstruction,
  getOutputModeInstruction,
} from "@/lib/gemini";
import { generateAIJson as generateAIJsonBase } from "@/lib/ai-provider";

export function getMattermostHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token.trim()}`,
    "Content-Type": "application/json",
  };
}

export function cleanMattermostMessage(text: string): string {
  if (!text) return "";
  let cleaned = text.trim();
  // Remove leading @username/botname mentions (e.g., @jira-bot, @bot)
  cleaned = cleaned.replace(/^@[a-zA-Z0-9_\-\u0600-\u06FF]+/i, "");
  return cleaned.trim();
}

export function isPersian(text: string): boolean {
  const farsiRegex = /[\u0600-\u06FF]/;
  return farsiRegex.test(text);
}

export async function processMattermostWebhookBackground(params: {
  draftText: string;
  user_name: string;
  channel_id: string;
  post_id: string;
  isFa: boolean;
}) {
  const { draftText, user_name, channel_id, post_id, isFa } = params;

  try {
    const aiProvider = process.env.AI_PROVIDER;

    const outputModeInstruction = getOutputModeInstruction();
    const systemInstruction = getMattermostRefineSystemInstruction(outputModeInstruction);

    const userPrompt = `Project Key: "PROJ"
Custom User Instructions/Prompt: Clean up descriptions, structure with Acceptance Criteria, and make them professional.

Raw Draft Content:
"""
${draftText}
"""`;

    console.log(
      `[Mattermost Webhook Background] Calling AI provider: ${aiProvider || "gemini"}`
    );

    const { data } = await generateAIJsonBase({
      provider: aiProvider,
      kind: "mattermostRefine",
      systemInstruction,
      userPrompt,
      temperature: 0.2,
    });
    let issuesList = data.issues || [];
    issuesList = issuesList.map((issue: any) => ({
      ...issue,
      summary: sanitizeJiraText(issue.summary),
      description: sanitizeJiraText(issue.description),
    }));
    console.log(
      `[Mattermost Webhook Background] Successfully refined ${issuesList.length} issues.`
    );

    const createdIssues: Record<string, string> = {};

    let jiraClient: ReturnType<typeof getJiraClient> | null = null;
    try {
      jiraClient = getJiraClient();
    } catch {
      jiraClient = null;
    }

    if (jiraClient) {
      console.log(
        `[Mattermost Webhook Background] Default Jira configured. Attempting to auto-create issues...`
      );
      const { jiraUrl, headers, projectKey: defaultJiraProject, config } =
        jiraClient;
      const epicNameField = config.epicNameField || "customfield_10008";
      const epicLinkField = config.epicLinkField || "customfield_10014";

      for (const issue of issuesList) {
        if (issue.issuetype === "Epic") {
          try {
            const fields: Record<string, any> = {
              project: { key: defaultJiraProject },
              summary: issue.summary,
              description: convertToJiraWikiMarkup(issue.description),
              issuetype: { name: "Epic" },
              labels: ["agent", "mattermost"],
              [epicNameField]: issue.summary,
            };
            if (issue.suggestedPriority) fields.priority = { name: issue.suggestedPriority };
            if (issue.suggestedComponent)
              fields.components = [{ name: issue.suggestedComponent }];

            const response = await fetch(`${jiraUrl}/rest/api/2/issue`, {
              method: "POST",
              headers,
              body: JSON.stringify({ fields }),
            });

            if (response.ok) {
              const resData = await response.json();
              createdIssues[issue.id] = resData.key;
              console.log(
                `[Mattermost Webhook Background] Created Epic in Jira: ${resData.key}`
              );
            } else {
              const errText = await response.text();
              console.error(
                `[Mattermost Webhook Background] Failed to create Epic. Status: ${response.status}, Error: ${errText}`
              );
            }
          } catch (err) {
            console.error(`[Mattermost Webhook Background] Error creating Epic in Jira:`, err);
          }
        }
      }

      for (const issue of issuesList) {
        if (issue.issuetype !== "Epic") {
          try {
            const fields: Record<string, any> = {
              project: { key: defaultJiraProject },
              summary: issue.summary,
              description: convertToJiraWikiMarkup(issue.description),
              issuetype: { name: issue.issuetype },
              labels: ["agent", "mattermost"],
            };
            if (issue.suggestedPriority) fields.priority = { name: issue.suggestedPriority };
            if (issue.suggestedComponent)
              fields.components = [{ name: issue.suggestedComponent }];

            const parentEpicKey = issue.epicReference
              ? createdIssues[issue.epicReference]
              : null;
            if (parentEpicKey) {
              fields[epicLinkField] = parentEpicKey;
            }

            const response = await fetch(`${jiraUrl}/rest/api/2/issue`, {
              method: "POST",
              headers,
              body: JSON.stringify({ fields }),
            });

            if (response.ok) {
              const resData = await response.json();
              createdIssues[issue.id] = resData.key;
              console.log(
                `[Mattermost Webhook Background] Created ${issue.issuetype} in Jira: ${resData.key}`
              );
            } else {
              const errText = await response.text();
              console.error(
                `[Mattermost Webhook Background] Failed to create ${issue.issuetype}. Status: ${response.status}, Error: ${errText}`
              );
            }
          } catch (err) {
            console.error(
              `[Mattermost Webhook Background] Error creating ${issue.issuetype} in Jira:`,
              err
            );
          }
        }
      }
    }

    let responseMarkdown = "";
    if (isFa) {
      responseMarkdown += `### 🚀 تیکت‌های اصلاح‌شده با هوش مصنوعی\n\n`;
      responseMarkdown += `@${user_name} عزیز، نیازمندی‌های شما با موفقیت اصلاح و آماده‌سازی شدند:\n\n`;
    } else {
      responseMarkdown += `### 🚀 AI-Refined Agile Issues\n\n`;
      responseMarkdown += `Hello @${user_name}, here are your refined issues based on your draft:\n\n`;
    }

    for (const issue of issuesList) {
      const createdKey = createdIssues[issue.id];
      let jiraInfo = "";
      if (createdKey && jiraClient) {
        const jiraLink = `${jiraClient.jiraUrl}/browse/${createdKey}`;
        jiraInfo = isFa
          ? `🔗 **تیکت ایجاد شده در جیرا:** [${createdKey}](${jiraLink})\n`
          : `🔗 **Jira Ticket Created:** [${createdKey}](${jiraLink})\n`;
      }

      responseMarkdown += `--- \n\n`;
      responseMarkdown += `#### 📋 **[${issue.issuetype.toUpperCase()}]** **${issue.summary}**\n`;
      if (jiraInfo) responseMarkdown += jiraInfo;
      responseMarkdown += isFa
        ? `* **اولویت:** \`${issue.suggestedPriority || "Medium"}\`\n`
        : `* **Priority:** \`${issue.suggestedPriority || "Medium"}\`\n`;

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

    const mmUrl = process.env.MATTERMOST_URL;
    const mmToken = process.env.MATTERMOST_BOT_TOKEN;

    if (mmUrl && mmToken && channel_id) {
      const postUrl = `${mmUrl.replace(/\/$/, "")}/api/v4/posts`;
      console.log(
        `[Mattermost Bot Webhook Background] Posting reply to channel ${channel_id}`
      );
      const body: Record<string, any> = {
        channel_id: channel_id,
        message: responseMarkdown,
      };
      if (post_id) {
        body.root_id = post_id;
      }

      const mmResponse = await fetch(postUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mmToken.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!mmResponse.ok) {
        const text = await mmResponse.text();
        console.error(
          `[Mattermost Bot Webhook Background] Failed to post to Mattermost API. Status: ${mmResponse.status}, Error: ${text}`
        );
      } else {
        console.log(
          `[Mattermost Bot Webhook Background] Successfully posted refined issues to Mattermost.`
        );
      }
    } else {
      console.warn(
        "[Mattermost Bot Webhook Background] Mattermost URL/Token or Channel ID missing. Outputting markdown to console:\n",
        responseMarkdown
      );
    }
  } catch (err: any) {
    console.error("[Mattermost Webhook Background Processing Error]:", err);
    const mmUrl = process.env.MATTERMOST_URL;
    const mmToken = process.env.MATTERMOST_BOT_TOKEN;
    if (mmUrl && mmToken && channel_id) {
      try {
        const errorReport = isFa
          ? `❌ خطایی در حین پردازش نیازمندی‌ها با هوش مصنوعی رخ داد:\n\`\`\`\n${err.message || err}\n\`\`\``
          : `❌ An error occurred during AI processing:\n\`\`\`\n${err.message || err}\n\`\`\``;

        await fetch(`${mmUrl.replace(/\/$/, "")}/api/v4/posts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mmToken.trim()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel_id: channel_id,
            message: errorReport,
            root_id: post_id || undefined,
          }),
        });
      } catch (e) {
        console.error("Failed to post error message to Mattermost:", e);
      }
    }
  }
}
