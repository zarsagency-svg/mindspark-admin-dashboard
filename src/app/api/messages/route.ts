import { NextRequest, NextResponse } from "next/server";
import { ApiError, rpc } from "@/lib/server";
import type { StudentMessageItem } from "@/components/types";

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

type Inbox = { messages: StudentMessageItem[]; unreadCount: number };

/** The unified admin inbox: Google-signed-in students and anonymous visitors. */
export async function GET(request: NextRequest) {
  try {
    const result = await rpc<Inbox>(request, "admin_list_messages");
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get("email") ?? "").trim().toLowerCase();
    const messages = email
      ? result.messages.filter((m) => m.googleEmail.toLowerCase() === email)
      : result.messages;
    return NextResponse.json({
      messages,
      unreadCount: messages.filter((m) => m.status === "unread").length,
    });
  } catch (error) {
    return fail(error, "Failed to load messages");
  }
}

/**
 * Submit a message to the admin. The sender's Google identity is read from their
 * verified Supabase auth record inside the database — never from the request
 * body — so nobody can message as someone else.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await rpc<{ message: StudentMessageItem }>(request, "submit_student_message", {
      p_category: body.category == null ? null : String(body.category),
      p_subject: body.subject == null ? null : String(body.subject),
      p_message: String(body.message ?? ""),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return fail(error, "Failed to send message");
  }
}

/** Reply to a message and/or change its read state. */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const result =
      typeof body.adminReply === "string"
        ? await rpc<{ message: StudentMessageItem }>(request, "admin_reply_message", {
            p_id: id,
            p_reply: body.adminReply,
          })
        : await rpc<{ message: StudentMessageItem }>(request, "admin_set_message_status", {
            p_id: id,
            p_status: String(body.status ?? "read"),
          });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to update message");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let id = Number(searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      const body = await request.json().catch(() => ({}));
      id = Number(body.id);
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const result = await rpc<{ deletedId: number }>(request, "admin_delete_message", { p_id: id });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to delete message");
  }
}
