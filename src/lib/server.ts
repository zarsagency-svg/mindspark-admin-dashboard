import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

/** Error carrying the HTTP status that should be returned to the browser. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Call a Supabase RPC on behalf of the signed-in user by forwarding their JWT.
 *
 * The publishable key only opens the door; every admin RPC re-checks
 * public.mindspark_is_admin() inside the database, so a stolen token or a
 * hand-crafted request from a non-allowlisted account is rejected server-side.
 */
export async function rpc<T = unknown>(
  request: Request,
  fn: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const authorization = request.headers.get("authorization") ?? "";

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_PUBLISHABLE_KEY,
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const detail =
      (payload as { message?: string; error?: string } | null)?.message ??
      (payload as { message?: string; error?: string } | null)?.error ??
      `Supabase request failed (${response.status})`;
    throw new ApiError(response.status, detail);
  }

  return payload as T;
}
