import { NextResponse } from "next/server";
import { getMattermostHeaders } from "@/lib/mattermost";

export async function POST() {
  try {
    const mmUrl = process.env.MATTERMOST_URL;
    const mmToken = process.env.MATTERMOST_BOT_TOKEN;

    if (!mmUrl || !mmToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Mattermost URL or Bot Token is missing in .env configurations.",
        },
        { status: 400 }
      );
    }

    const cleanUrl = mmUrl.replace(/\/$/, "");

    console.log(`[Mattermost Test] Querying user profile: ${cleanUrl}/api/v4/users/me`);
    const meResponse = await fetch(`${cleanUrl}/api/v4/users/me`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken),
    });

    if (!meResponse.ok) {
      const errText = await meResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: `Failed to authenticate with Mattermost. Status: ${meResponse.status}, Response: ${errText}`,
        },
        { status: meResponse.status }
      );
    }

    const botUser = await meResponse.json();

    console.log(`[Mattermost Test] Querying bot teams: ${cleanUrl}/api/v4/users/me/teams`);
    const teamsResponse = await fetch(`${cleanUrl}/api/v4/users/me/teams`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken),
    });

    let teams = [];
    if (teamsResponse.ok) {
      teams = await teamsResponse.json();
    }

    console.log(
      `[Mattermost Test] Querying bot channels: ${cleanUrl}/api/v4/users/me/channels`
    );
    const channelsResponse = await fetch(`${cleanUrl}/api/v4/users/me/channels`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken),
    });

    let channels = [];
    if (channelsResponse.ok) {
      channels = await channelsResponse.json();
    }

    return NextResponse.json({
      success: true,
      botUser,
      teams,
      channelsCount: channels.length,
      config: {
        url: cleanUrl,
      },
    });
  } catch (err: any) {
    console.error("[Mattermost Test Connection Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "An unexpected error occurred while connecting to Mattermost.",
      },
      { status: 500 }
    );
  }
}
