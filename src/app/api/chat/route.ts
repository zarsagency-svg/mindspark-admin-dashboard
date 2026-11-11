import { NextRequest, NextResponse } from "next/server";
import { ApiError, rpc } from "@/lib/server";
import type { ChatConversationItem, ChatMessageItem } from "@/components/types";

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Every WhatsApp-style conversation thread, newest activity first. */
export async function GET(request: NextRequest) {
  try {
    const conversations = await rpc<ChatConversationItem[]>(
      request,
      "admin_list_conversations",
    );
    const unreadCount = conversations.reduce(
      (sum, c) => sum + (c.unreadByAdmin || 0),
      0,
    );
    return NextResponse.json({ conversations, unreadCount });
  } catch (error) {
    return fail(error, "Failed to load conversations");
  }
}

/** Send an admin reply into a thread. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const conversationId = String(body.conversationId ?? "").trim();
    if (!conversationId) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }

    const result = await rpc<{
      message: ChatMessageItem;
      conversation: ChatConversationItem;
    }>(request, "admin_send_chat", {
      p_id: conversationId,
      p_body: String(body.body ?? ""),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return fail(error, "Failed to send message");
  }
}
