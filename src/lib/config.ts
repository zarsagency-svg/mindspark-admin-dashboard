// Shared runtime configuration.
// Values can be overridden with environment variables; the fallbacks keep the
// app working with the publishable (public) Supabase key, which is safe to ship
// because every privileged operation is enforced by security-definer RPCs.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://duoynnsuogaekjtdzcrd.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_tt29PlGr1WMeZOY8Pa3IfQ_wmhd6432";

// The visitor-facing site this console publishes announcements to.
export const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mindspark-all.vercel.app";
