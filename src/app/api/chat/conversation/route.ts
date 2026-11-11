import { NextRequest, NextResponse } from "next/server";
import { ApiError, rpc } from "@/lib/server";
import type {
  ChatConversationItem,
  ChatMessageItem,
} from "@/components/types";

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

function readId(request: NextRequest, body?: unknown): string {
  const fromQuery = new URL(request.url).searchParams.get("id");
  if (fromQuery) return fromQuery.trim();
  if (body && typeof body === "object") {
    return String((body as { id?: unknown }).id ?? "").trim();
  }
  return "";
}

/** Open one thread. Marking it read happens inside the database function. */
export async function GET(request: NextRequest) {
  try {
    const id = readId(request);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }
    const result = await rpc<{
      conversation: ChatConversationItem;
      messages: ChatMessageItem[];
    }>(request, "admin_get_conversation", { p_id: id });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to load conversation");
  }
}

/** Delete a thread and all of its messages. */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const id = readId(request, body);
    if (!id) {
      return NextResponse.json(
        { error: "Invalid conversation ID" },
        { status: 400 },
      );
    }
    const result = await rpc<{ deletedId: string }>(
      request,
      "admin_delete_conversation",
      { p_id: id },
    );
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to delete conversation");
  }
}
