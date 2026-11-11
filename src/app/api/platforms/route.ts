import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { platforms } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { DEFAULT_PLATFORMS, generateCustomPlatformSvg } from "@/data/platforms";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    await ensureSeeded();
    const rows = await db
      .select()
      .from(platforms)
      .orderBy(asc(platforms.sortOrder), asc(platforms.id));
    return NextResponse.json({ platforms: rows });
  } catch (error) {
    console.error("GET /api/platforms error:", error);
    return NextResponse.json(
      { error: "Failed to load platforms" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json();

    if (body.action === "reset") {
      await db.delete(platforms);
      const inserted = await db
        .insert(platforms)
        .values(
          DEFAULT_PLATFORMS.map((p, idx) => ({
            name: p.name,
            subtitle: p.subtitle,
            metaText: p.metaText,
            category: p.category,
            href: p.href || "",
            isModal: Boolean(p.isModal),
            title: p.title,
            imgSrc: p.imgSrc,
            imgAlt: p.imgAlt,
            objectFit: p.objectFit,
            tiltAngle: p.tiltAngle,
            accentShade: p.accentShade,
            delayMs: p.delayMs,
            sortOrder: p.sortOrder ?? idx + 1,
          }))
        )
        .returning();
      return NextResponse.json({ platforms: inserted });
    }

    const name = String(body.name || "").trim();
    const subtitle = String(body.subtitle || "").trim();
    const metaText = String(
      body.metaText || "Free Access · Live & Recorded"
    ).trim();

    if (!name || !subtitle) {
      return NextResponse.json(
        { error: "Platform name and subtitle are required." },
        { status: 400 }
      );
    }

    const category =
      body.category === "jee-neet" || body.category === "tools"
        ? body.category
        : "boards";
    const accentShade = String(body.accentShade || "#2E5DE6").trim();
    const imgSrc =
      String(body.imgSrc || "").trim() ||
      generateCustomPlatformSvg(name, accentShade);
    const imgAlt = String(body.imgAlt || `${name} - MIND SPARK`).trim();
    const title = String(body.title || `${name} on MIND SPARK Ecosystem`).trim();
    const href = String(body.href || "").trim();
    const isModal = Boolean(body.isModal);
    const objectFit = body.objectFit === "contain" ? "contain" : "cover";
    const tiltAngle = Number.isFinite(Number(body.tiltAngle))
      ? Math.max(-20, Math.min(20, Number(body.tiltAngle)))
      : -8;
    const delayMs = Number.isFinite(Number(body.delayMs))
      ? Number(body.delayMs)
      : 200;
    const sortOrder = Number.isFinite(Number(body.sortOrder))
      ? Number(body.sortOrder)
      : 99;

    const [created] = await db
      .insert(platforms)
      .values({
        name,
        subtitle,
        metaText,
        category,
        href,
        isModal,
        title,
        imgSrc,
        imgAlt,
        objectFit,
        tiltAngle,
        accentShade,
        delayMs,
        sortOrder,
      })
      .returning();

    return NextResponse.json({ platform: created }, { status: 201 });
  } catch (error) {
    console.error("POST /api/platforms error:", error);
    return NextResponse.json(
      { error: "Failed to create platform" },
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
      return NextResponse.json({ error: "Invalid platform ID" }, { status: 400 });
    }

    const name = String(body.name || "").trim();
    const subtitle = String(body.subtitle || "").trim();
    if (!name || !subtitle) {
      return NextResponse.json(
        { error: "Platform name and subtitle are required." },
        { status: 400 }
      );
    }

    const accentShade = String(body.accentShade || "#2E5DE6").trim();
    const imgSrc =
      String(body.imgSrc || "").trim() ||
      generateCustomPlatformSvg(name, accentShade);

    const [updated] = await db
      .update(platforms)
      .set({
        name,
        subtitle,
        metaText: String(body.metaText || "Free Access · Live & Recorded").trim(),
        category:
          body.category === "jee-neet" || body.category === "tools"
            ? body.category
            : "boards",
        href: String(body.href || "").trim(),
        isModal: Boolean(body.isModal),
        title: String(body.title || `${name} - MIND SPARK`).trim(),
        imgSrc,
        imgAlt: String(body.imgAlt || `${name} Logo`).trim(),
        objectFit: body.objectFit === "contain" ? "contain" : "cover",
        tiltAngle: Number.isFinite(Number(body.tiltAngle))
          ? Number(body.tiltAngle)
          : -8,
        accentShade,
        sortOrder: Number.isFinite(Number(body.sortOrder))
          ? Number(body.sortOrder)
          : 10,
      })
      .where(eq(platforms.id, id))
      .returning();

    return NextResponse.json({ platform: updated });
  } catch (error) {
    console.error("PUT /api/platforms error:", error);
    return NextResponse.json(
      { error: "Failed to update platform" },
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
      return NextResponse.json({ error: "Invalid platform ID" }, { status: 400 });
    }

    await db.delete(platforms).where(eq(platforms.id, id));
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    console.error("DELETE /api/platforms error:", error);
    return NextResponse.json(
      { error: "Failed to delete platform" },
      { status: 500 }
    );
  }
}
