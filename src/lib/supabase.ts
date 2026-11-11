import { createClient } from "@supabase/supabase-js";
export const supabase = createClient("https://duoynnsuogaekjtdzcrd.supabase.co", "sb_publishable_tt29PlGr1WMeZOY8Pa3IfQ_wmhd6432");
export async function adminFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Please sign in again.");
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}
