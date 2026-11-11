import { NextRequest, NextResponse } from "next/server";
import { ApiError, rpc } from "@/lib/server";
import type { AnnouncementItem } from "@/components/types";

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Announcements for the admin console, pinned first then newest. */
export async function GET(request: NextRequest) {
  try {
    const announcements = await rpc<AnnouncementItem[]>(request, "admin_list_announcements");
    return NextResponse.json({ announcements });
  } catch (error) {
    return fail(error, "Failed to load announcements");
  }
}

/** Publish an announcement. It lands in public.mindspark_notifications, which is
 *  the same table the live visitor site reads, so it appears there immediately. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.action === "like") {
      return NextResponse.json(
        { error: "Likes are cast by visitors on the live site and cannot be edited here." },
        { status: 400 },
      );
    }

    const result = await rpc<{ announcement: AnnouncementItem }>(request, "admin_create_announcement", {
      p_title: String(body.title ?? ""),
      p_body: String(body.text ?? ""),
      p_tag: body.tag == null ? null : String(body.tag),
      p_image_url: body.imageUrl == null ? null : String(body.imageUrl),
      p_is_pinned: Boolean(body.isPinned),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return fail(error, "Failed to publish announcement");
  }
}

/** Edit title/body/tag/image/pin state. Omitted fields are left unchanged. */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "Invalid announcement ID" }, { status: 400 });
    }

    const result = await rpc<{ announcement: AnnouncementItem }>(request, "admin_update_announcement", {
      p_id: id,
      p_title: typeof body.title === "string" ? body.title : null,
      p_body: typeof body.text === "string" ? body.text : null,
      p_tag: typeof body.tag === "string" ? body.tag : null,
      p_image_url: typeof body.imageUrl === "string" ? body.imageUrl : null,
      p_is_pinned: typeof body.isPinned === "boolean" ? body.isPinned : null,
    });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to update announcement");
  }
}

/** Delete an announcement (its visitor likes cascade away with it). */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let id = (searchParams.get("id") ?? "").trim();
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = String(body.id ?? "").trim();
    }
    if (!id) {
      return NextResponse.json({ error: "Invalid announcement ID" }, { status: 400 });
    }

    const result = await rpc<{ deletedId: string }>(request, "admin_delete_announcement", { p_id: id });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to delete announcement");
  }
}
