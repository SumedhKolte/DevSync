import { HttpError, sessionCookieOptions } from "./http";
export { HttpError } from "./http";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "../database.types";
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export async function userClient() {
  if (!isConfigured()) throw new Error("Supabase is not configured.");
  const jar = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: sessionCookieOptions(),
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (list) => {
          try {
            list.forEach((c) => jar.set(c.name, c.value, c.options));
          } catch {
            /* Server Components cannot write cookies; proxy refreshes them. */
          }
        },
      },
    },
  );
}
/** The signed-in user, verified once per server render. */
export const currentUser = cache(async () => {
  const {
    data: { user },
  } = await (await userClient()).auth.getUser();
  return user;
});
export function adminClient() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("Server-side Supabase credentials are not configured.");
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export async function requireUser() {
  const db = await userClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new HttpError(401, "Sign in to continue.");
  return { db, user };
}
export function appOrigin() {
  return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    .origin;
}
export function assertOrigin(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    throw new HttpError(403, "Request origin is not allowed.");
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  return Response.json(
    {
      error:
        "The operation could not be completed. Check your connection and server configuration.",
    },
    { status: 500 },
  );
}
