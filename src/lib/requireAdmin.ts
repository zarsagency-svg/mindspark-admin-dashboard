import { NextRequest, NextResponse } from "next/server";

// Supabase validates the bearer token; identity and email checks happen server-side.
const SUPABASE_URL = "https://duoynnsuogaekjtdzcrd.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_tt29PlGr1WMeZOY8Pa3IfQ_wmhd6432";
const ADMIN_EMAIL = "zarsagency@gmail.com";

export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization)) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: PUBLISHABLE_KEY, authorization },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const user = await response.json();
    const googleIdentity = Array.isArray(user.identities) && user.identities.some((identity: {provider?: string; identity_data?: {email?: string; email_verified?: boolean}}) =>
      identity.provider === "google" && identity.identity_data?.email_verified === true &&
      identity.identity_data.email?.toLowerCase() === ADMIN_EMAIL
    );
    if (user.email?.toLowerCase() !== ADMIN_EMAIL || !user.email_confirmed_at || !googleIdentity) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }
}
