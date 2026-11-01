import { NextResponse } from "next/server";
import { googleSignInEnabled } from "@/lib/server/auth-settings";
import { appOrigin, assertOrigin, userClient } from "@/lib/server/supabase";
// Starts Supabase's Google OAuth flow. The PKCE verifier is stored in a
// session cookie here, and /auth/callback exchanges the returned code.
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    if (!(await googleSignInEnabled()))
      return NextResponse.redirect(
        `${appOrigin()}/login?error=google-unavailable`,
        303,
      );
    const db = await userClient();
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appOrigin()}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url) throw error ?? new Error("No authorization URL");
    return NextResponse.redirect(data.url, 303);
  } catch {
    return NextResponse.redirect(`${appOrigin()}/login?error=oauth`, 303);
  }
}
