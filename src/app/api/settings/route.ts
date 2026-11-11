import { requireAdmin } from "@/lib/requireAdmin";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureSeeded();
    const rows = await db.select().from(siteSettings);
    const current = rows[0] || {
      id: 1,
      palette: "blue",
      customColour: "#a855f7",
      cardStyle: "folder",
      allowUserThemeOverride: true,
      telegramChannel: "https://t.me/zarsstudy",
    };

    return NextResponse.json({
      settings: {
        id: current.id,
        palette: current.palette,
        customColour: current.customColour,
        cardStyle: current.cardStyle,
        allowUserThemeOverride: current.allowUserThemeOverride,
        telegramChannel: current.telegramChannel,
      },
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to load site settings" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    await ensureSeeded();
    const body = await req.json();
    const rows = await db.select().from(siteSettings);
    const existing = rows[0];

    const palette =
      body.palette === "red" ||
      body.palette === "green" ||
      body.palette === "custom"
        ? body.palette
        : "blue";
    const customColour = String(body.customColour || "#a855f7").trim();
    const cardStyle = body.cardStyle === "card" ? "card" : "folder";
    const allowUserThemeOverride =
      typeof body.allowUserThemeOverride === "boolean"
        ? body.allowUserThemeOverride
        : true;
    const telegramChannel = String(
      body.telegramChannel || "https://t.me/zarsstudy"
    ).trim();

    if (!existing) {
      const [created] = await db
        .insert(siteSettings)
        .values({
          palette,
          customColour,
          cardStyle,
          allowUserThemeOverride,
          telegramChannel,
        })
        .returning();
      return NextResponse.json({ settings: created });
    }

    const updatePayload: Record<string, unknown> = {
      palette,
      customColour,
      cardStyle,
      allowUserThemeOverride,
      telegramChannel,
      updatedAt: new Date(),
    };

    if (typeof body.adminPasscode === "string" && body.adminPasscode.trim()) {
      updatePayload.adminPasscode = body.adminPasscode.trim();
    }

    const [updated] = await db
      .update(siteSettings)
      .set(updatePayload)
      .where(eq(siteSettings.id, existing.id))
      .returning();

    return NextResponse.json({
      settings: {
        id: updated.id,
        palette: updated.palette,
        customColour: updated.customColour,
        cardStyle: updated.cardStyle,
        allowUserThemeOverride: updated.allowUserThemeOverride,
        telegramChannel: updated.telegramChannel,
      },
    });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

// The previous default-passcode login was insecure. Google login must be wired in before deployment.
export async function POST() {
  return NextResponse.json({ error: "Passcode login is disabled" }, { status: 410 });
}
