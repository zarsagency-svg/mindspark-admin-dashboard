import { NextRequest, NextResponse } from "next/server";
import { ApiError, rpc } from "@/lib/server";
import { DEFAULT_PLATFORMS, generateCustomPlatformSvg, type PlatformItem } from "@/data/platforms";

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** Logo files that actually ship in /public. Anything else is generated so the
 *  architect never renders a broken image. Swap in real logos by editing a
 *  platform in the console, or by adding the file here. */
const BUNDLED_LOGOS = new Set(["/platforms/noxglass.svg"]);

function resolveDefaults() {
  return DEFAULT_PLATFORMS.map((platform, index) => ({
    ...platform,
    imgSrc:
      platform.imgSrc.startsWith("/platforms/") && !BUNDLED_LOGOS.has(platform.imgSrc)
        ? generateCustomPlatformSvg(platform.name, platform.accentShade)
        : platform.imgSrc,
    sortOrder: platform.sortOrder ?? index + 1,
  }));
}

export async function GET(request: NextRequest) {
  try {
    let platforms = await rpc<PlatformItem[]>(request, "admin_list_platforms");

    // First run: seed the eight default platforms so the console is not empty.
    if (platforms.length === 0) {
      const seeded = await rpc<{ platforms: PlatformItem[] }>(request, "admin_reset_platforms", {
        p_platforms: resolveDefaults(),
      });
      platforms = seeded.platforms;
    }

    return NextResponse.json({ platforms });
  } catch (error) {
    return fail(error, "Failed to load platforms");
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.action === "reset") {
      const result = await rpc<{ platforms: PlatformItem[] }>(request, "admin_reset_platforms", {
        p_platforms: resolveDefaults(),
      });
      return NextResponse.json(result);
    }

    const result = await rpc<{ platform: PlatformItem }>(request, "admin_save_platform", {
      p_platform: body,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return fail(error, "Failed to save platform");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await rpc<{ platform: PlatformItem }>(request, "admin_save_platform", {
      p_platform: body,
    });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to update platform");
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
      return NextResponse.json({ error: "Invalid platform ID" }, { status: 400 });
    }

    const result = await rpc<{ deletedId: number }>(request, "admin_delete_platform", { p_id: id });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to remove platform");
  }
}
