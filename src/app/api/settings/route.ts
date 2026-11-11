import { NextRequest, NextResponse } from "next/server";
import { ApiError, rpc } from "@/lib/server";

export const dynamic = "force-dynamic";

function fail(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const settings = await rpc<Record<string, unknown>>(request, "admin_get_settings");
    return NextResponse.json({ settings });
  } catch (error) {
    return fail(error, "Failed to load site settings");
  }
}

/** Save palette / card style / Telegram channel. There is no passcode any more:
 *  administrator access is Google sign-in checked against the allowlist table. */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { adminPasscode: _ignored, ...settings } = body as Record<string, unknown>;

    const result = await rpc<{ settings: Record<string, unknown> }>(request, "admin_save_settings", {
      p_settings: settings,
    });
    return NextResponse.json(result);
  } catch (error) {
    return fail(error, "Failed to save site settings");
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Passcode sign-in has been removed. Administrators sign in with Google and are checked against the allowlist in Supabase.",
    },
    { status: 405 },
  );
}
