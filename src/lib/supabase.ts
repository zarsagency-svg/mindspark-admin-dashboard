import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * `fetch` that attaches the signed-in administrator's access token, so the
 * server-side API routes can call Supabase RPCs on their behalf. Authorization
 * is decided in the database (public.mindspark_admins), never in the browser.
 */
export async function adminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const {
    data: { session: currentSession },
  } = await supabase.auth.getSession();

  let session = currentSession;
  if (
    session?.expires_at &&
    session.expires_at * 1000 - Date.now() < 30_000
  ) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) {
      session = refreshed.session;
    }
  }

  if (!session) {
    throw new Error("Please sign in again.");
  }

  const doRequest = (accessToken: string) => {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(input, {
      ...init,
      headers,
      cache: "no-store",
    });
  };

  const response = await doRequest(session.access_token);
  if (response.status === 401) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) {
      return doRequest(refreshed.session.access_token);
    }
  }

  return response;
}
