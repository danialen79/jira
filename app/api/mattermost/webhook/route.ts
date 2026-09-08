import { NextResponse, after } from "next/server";
import {
  cleanMattermostMessage,
  isPersian,
  processMattermostWebhookBackground,
} from "@/lib/mattermost";

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, any> = {};

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        body[key] = typeof value === "string" ? value : value.name;
      });
    } else {
      try {
        body = await req.json();
      } catch {
        const text = await req.text();
        if (text) {
          try {
            body = Object.fromEntries(new URLSearchParams(text));
          } catch {
            body = { text };
          }
        }
      }
    }

    const rawText = body.text || body.message || "";
    const user_name = body.user_name || body.sender_name || "User";
    const channel_id = body.channel_id || "";
    const post_id = body.post_id || body.id || "";

    console.log(
      `[Mattermost Webhook] Received message from ${user_name} in channel ${channel_id}: "${rawText}"`
    );

    if (!rawText.trim()) {
      return NextResponse.json({
        text: "پیام خالی است. لطفاً متن یا پیش‌نویس نیازمندی خود را ارسال کنید.",
      });
    }

    const draftText = cleanMattermostMessage(rawText);
    if (!draftText) {
      return NextResponse.json({
        text: "لطفاً متن یا پیش‌نویس نیازمندی خود را بعد از منشن وارد کنید.",
      });
    }

    const isFa = isPersian(draftText);

    const ackMessage = isFa
      ? `@${user_name} در حال اصلاح پیش‌نویس…`
      : `@${user_name} Refining your draft…`;

    after(() =>
      processMattermostWebhookBackground({
        draftText,
        user_name,
        channel_id,
        post_id,
        isFa,
      })
    );

    return NextResponse.json({ text: ackMessage });
  } catch (err: any) {
    console.error("Mattermost Webhook Route Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
