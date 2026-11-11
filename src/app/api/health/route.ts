import { NextResponse } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Liveness probe: can we reach Supabase and read public site config? */
export async function GET() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/public_site_config`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ ok: false }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
