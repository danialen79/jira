import { NextResponse } from "next/server";
import { cleanMattermostMessage, getMattermostHeaders } from "@/lib/mattermost";

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

    const meResponse = await fetch(`${cleanUrl}/api/v4/users/me`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken),
    });

    if (!meResponse.ok) {
      const errText = await meResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: `Authentication failed. Status: ${meResponse.status}, Error: ${errText}`,
        },
        { status: meResponse.status }
      );
    }

    const botUser = await meResponse.json();
    const botId = botUser.id;
    const botUsername = botUser.username;

    const channelsResponse = await fetch(`${cleanUrl}/api/v4/users/me/channels`, {
      method: "GET",
      headers: getMattermostHeaders(mmToken),
    });

    if (!channelsResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to load channels. Status: ${channelsResponse.status}`,
        },
        { status: channelsResponse.status }
      );
    }

    const channels = await channelsResponse.json();
    if (!channels || channels.length === 0) {
      return NextResponse.json({
        success: true,
        drafts: [],
        message: "No channels found for this bot. Invite the bot to a channel first.",
      });
    }

    const allPosts: any[] = [];
    const channelMap: Record<string, string> = {};
    const userIdsSet = new Set<string>();

    for (const channel of channels) {
      channelMap[channel.id] = channel.display_name || channel.name;

      try {
        const postsResponse = await fetch(
          `${cleanUrl}/api/v4/channels/${channel.id}/posts?page=0&per_page=20`,
          {
            method: "GET",
            headers: getMattermostHeaders(mmToken),
          }
        );

        if (postsResponse.ok) {
          const postsData = await postsResponse.json();
          const postsObj = postsData.posts || {};
          const order = postsData.order || [];

          for (const postId of order) {
            const post = postsObj[postId];
            if (post && post.user_id !== botId) {
              allPosts.push({
                id: post.id,
                channelId: post.channel_id,
                channelName: channelMap[post.channel_id],
                message: post.message || "",
                userId: post.user_id,
                createdAt: post.create_at || 0,
              });
              userIdsSet.add(post.user_id);
            }
          }
        }
      } catch (err) {
        console.error(`Failed to fetch posts for channel ${channel.id}:`, err);
      }
    }

    const userMap: Record<string, string> = {};
    const userIdsList = Array.from(userIdsSet);
    if (userIdsList.length > 0) {
      try {
        const usersResponse = await fetch(`${cleanUrl}/api/v4/users/ids`, {
          method: "POST",
          headers: getMattermostHeaders(mmToken),
          body: JSON.stringify(userIdsList),
        });

        if (usersResponse.ok) {
          const usersList = await usersResponse.json();
          for (const user of usersList) {
            userMap[user.id] = user.nickname || user.first_name
              ? `${user.first_name} ${user.last_name || ""}`.trim()
              : `@${user.username}`;
          }
        }
      } catch (err) {
        console.error("Failed to batch lookup users:", err);
      }
    }

    const finalDrafts = allPosts.map((post) => {
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
        isMention,
      };
    });

    finalDrafts.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      success: true,
      botUsername,
      drafts: finalDrafts,
    });
  } catch (err: any) {
    console.error("[Mattermost Get Drafts Error]:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "An unexpected error occurred while loading drafts.",
      },
      { status: 500 }
    );
  }
}
