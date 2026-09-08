import { NextResponse } from "next/server";

export async function GET() {
  try {
    const url = process.env.MATTERMOST_URL || "";
    const hasToken = !!process.env.MATTERMOST_BOT_TOKEN;
    return NextResponse.json({
      url,
      hasToken,
      configured: !!(url && hasToken),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
