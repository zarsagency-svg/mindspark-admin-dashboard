import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { studentMessages } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { desc, eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get("email") || "").trim().toLowerCase();

    const rows = email
      ? await db
          .select()
          .from(studentMessages)
          .where(eq(studentMessages.googleEmail, email))
          .orderBy(desc(studentMessages.createdAt))
      : await db
          .select()
          .from(studentMessages)
          .orderBy(desc(studentMessages.createdAt));

    const unreadCount = rows.filter((r) => r.status === "unread").length;

    return NextResponse.json({
      messages: rows.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt).getTime(),
        repliedAt: r.repliedAt ? new Date(r.repliedAt).getTime() : null,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("GET /api/messages error:", error);
    return NextResponse.json(
      { error: "Failed to load student messages" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureSeeded();
    const body = await req.json();

    const googleEmail = String(body.googleEmail || "")
      .trim()
      .toLowerCase();
    const googleName = String(body.googleName || "").trim();
    const googleSub = String(body.googleSub || "").trim();
    const googleAvatar =
      String(body.googleAvatar || "").trim() ||
      googleName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() ||
      "ST";

    if (!googleEmail || !googleName || !googleSub) {
      return NextResponse.json(
        {
          error:
            "You must sign in with a valid Google account before sending a message to Admin.",
        },
        { status: 401 }
      );
    }

    const category = String(body.category || "Batch Request").trim();
    const subject = String(body.subject || "Student Inquiry").trim();
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Please enter a message before sending." },
        { status: 400 }
      );
    }

    const [created] = await db
      .insert(studentMessages)
      .values({
        googleEmail,
        googleName,
        googleAvatar,
        googleSub,
        category,
        subject,
        message,
        status: "unread",
        adminReply: "",
      })
      .returning();

    return NextResponse.json(
      {
        message: {
          ...created,
          createdAt: new Date(created.createdAt).getTime(),
          repliedAt: null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/messages error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureSeeded();
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof body.status === "string") {
      updateData.status = body.status;
    }
    if (typeof body.adminReply === "string") {
      const reply = body.adminReply.trim();
      updateData.adminReply = reply;
      if (reply) {
        updateData.status = "replied";
        updateData.repliedAt = new Date();
      }
    }

    const [updated] = await db
      .update(studentMessages)
      .set(updateData)
      .where(eq(studentMessages.id, id))
      .returning();

    return NextResponse.json({
      message: {
        ...updated,
        createdAt: new Date(updated.createdAt).getTime(),
        repliedAt: updated.repliedAt
          ? new Date(updated.repliedAt).getTime()
          : null,
      },
    });
  } catch (error) {
    console.error("PATCH /api/messages error:", error);
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    let id = Number(searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      const body = await req.json().catch(() => ({}));
      id = Number(body.id);
    }
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    await db.delete(studentMessages).where(eq(studentMessages.id, id));
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    console.error("DELETE /api/messages error:", error);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
