import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { userClient, appOrigin } from "@/lib/server/supabase";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  try {
    if (code && !url.searchParams.has("error")) {
      const db = await userClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) {
        const jar = await cookies();
        const recovery = jar.get("devsync_auth_flow")?.value === "recovery";
        jar.delete("devsync_auth_flow");
        return NextResponse.redirect(
          `${appOrigin()}${recovery ? "/password" : "/"}`,
        );
      }
    }
  } catch {
    /* Redirect to a useful recovery state without exposing provider details. */
  }
  return NextResponse.redirect(`${appOrigin()}/login?error=invalid-link`);
}
