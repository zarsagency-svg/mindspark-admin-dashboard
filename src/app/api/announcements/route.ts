import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { announcements, announcementLikes } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { and, desc, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const visitorId = searchParams.get("visitorId") || "";

    const rows = await db
      .select()
      .from(announcements)
      .orderBy(desc(announcements.isPinned), desc(announcements.createdAt));

    let likedIds = new Set<number>();
    if (visitorId) {
      const likes = await db
        .select()
        .from(announcementLikes)
        .where(eq(announcementLikes.visitorId, visitorId));
      likedIds = new Set(likes.map((l) => l.announcementId));
    }

    const mapped = rows.map((row) => ({
      id: String(row.id),
      numericId: row.id,
      title: row.title,
      text: row.text,
      tag: row.tag,
      imageUrl: row.imageUrl || undefined,
      authorName: row.authorName,
      isPinned: row.isPinned,
      likes: row.likes,
      liked: likedIds.has(row.id),
      createdAt: new Date(row.createdAt).getTime(),
    }));

    return NextResponse.json({ announcements: mapped });
  } catch (error) {
    console.error("GET /api/announcements error:", error);
    return NextResponse.json(
      { error: "Failed to load announcements" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json();

    // Handle toggling like on an announcement
    if (body.action === "like") {
      const announcementId = Number(body.announcementId);
      const visitorId = String(body.visitorId || "anonymous-visitor");
      if (!Number.isFinite(announcementId)) {
        return NextResponse.json(
          { error: "Invalid announcement ID" },
          { status: 400 }
        );
      }

      const existing = await db
        .select()
        .from(announcementLikes)
        .where(
          and(
            eq(announcementLikes.announcementId, announcementId),
            eq(announcementLikes.visitorId, visitorId)
          )
        );

      let liked = false;
      if (existing.length > 0) {
        await db
          .delete(announcementLikes)
          .where(
            and(
              eq(announcementLikes.announcementId, announcementId),
              eq(announcementLikes.visitorId, visitorId)
            )
          );
        await db
          .update(announcements)
          .set({
            likes: sql`GREATEST(0, ${announcements.likes} - 1)`,
          })
          .where(eq(announcements.id, announcementId));
        liked = false;
      } else {
        await db.insert(announcementLikes).values({
          announcementId,
          visitorId,
        });
        await db
          .update(announcements)
          .set({
            likes: sql`${announcements.likes} + 1`,
          })
          .where(eq(announcements.id, announcementId));
        liked = true;
      }

      const [updated] = await db
        .select()
        .from(announcements)
        .where(eq(announcements.id, announcementId));

      return NextResponse.json({
        liked,
        likes: updated ? updated.likes : 0,
      });
    }

    // Create new announcement
    const title = String(body.title || "").trim();
    const text = String(body.text || "").trim();
    if (!title || !text) {
      return NextResponse.json(
        { error: "Announcement title and message body are required." },
        { status: 400 }
      );
    }

    const tag = String(body.tag || "Official Broadcast").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const authorName = String(body.authorName || "Mr Sad · Admin").trim();
    const isPinned = Boolean(body.isPinned);

    const [created] = await db
      .insert(announcements)
      .values({
        title,
        text,
        tag,
        imageUrl,
        authorName,
        isPinned,
        likes: 0,
      })
      .returning();

    return NextResponse.json(
      {
        announcement: {
          id: String(created.id),
          numericId: created.id,
          title: created.title,
          text: created.text,
          tag: created.tag,
          imageUrl: created.imageUrl || undefined,
          authorName: created.authorName,
          isPinned: created.isPinned,
          likes: created.likes,
          liked: false,
          createdAt: new Date(created.createdAt).getTime(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/announcements error:", error);
    return NextResponse.json(
      { error: "Failed to process announcement" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: "Invalid announcement ID" },
        { status: 400 }
      );
    }

    const updateFields: Record<string, unknown> = {};
    if (typeof body.title === "string") updateFields.title = body.title.trim();
    if (typeof body.text === "string") updateFields.text = body.text.trim();
    if (typeof body.tag === "string") updateFields.tag = body.tag.trim();
    if (typeof body.imageUrl === "string")
      updateFields.imageUrl = body.imageUrl.trim();
    if (typeof body.isPinned === "boolean")
      updateFields.isPinned = body.isPinned;

    const [updated] = await db
      .update(announcements)
      .set(updateFields)
      .where(eq(announcements.id, id))
      .returning();

    return NextResponse.json({
      announcement: {
        id: String(updated.id),
        numericId: updated.id,
        title: updated.title,
        text: updated.text,
        tag: updated.tag,
        imageUrl: updated.imageUrl || undefined,
        authorName: updated.authorName,
        isPinned: updated.isPinned,
        likes: updated.likes,
        liked: false,
        createdAt: new Date(updated.createdAt).getTime(),
      },
    });
  } catch (error) {
    console.error("PUT /api/announcements error:", error);
    return NextResponse.json(
      { error: "Failed to update announcement" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      const body = await req.json().catch(() => ({}));
      id = Number(body.id);
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: "Invalid announcement ID" },
        { status: 400 }
      );
    }

    await db.delete(announcements).where(eq(announcements.id, id));
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    console.error("DELETE /api/announcements error:", error);
    return NextResponse.json(
      { error: "Failed to delete announcement" },
      { status: 500 }
    );
  }
}
