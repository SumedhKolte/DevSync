import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/server/crypto";
import { appOrigin, HttpError, requireUser } from "@/lib/server/supabase";
import { connectionErrorRedirect } from "@/lib/server/connection-redirect";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    await requireUser();
    const { provider } = await params;
    if (!["github", "jira"].includes(provider))
      throw new HttpError(404, "Unknown provider");
    const url = new URL(request.url);
    const jar = await cookies();
    if (provider === "github" && url.searchParams.has("installation_id"))
      return NextResponse.redirect(
        `${appOrigin()}${jar.get("devsync_pending_github") ? "/connect/github" : "/api/connect/github"}`,
      );
    const expected = jar.get(`devsync_oauth_${provider}`)?.value;
    const state = url.searchParams.get("state");
    jar.delete(`devsync_oauth_${provider}`);
    if (!expected || state !== expected || !url.searchParams.get("code"))
      throw new HttpError(
        400,
        "Authorization was cancelled or expired. Please reconnect from Connections.",
      );
    const r = await fetch(
      provider === "jira"
        ? "https://auth.atlassian.com/oauth/token"
        : "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id:
            process.env[
              provider === "jira" ? "JIRA_CLIENT_ID" : "GITHUB_CLIENT_ID"
            ],
          client_secret:
            process.env[
              provider === "jira"
                ? "JIRA_CLIENT_SECRET"
                : "GITHUB_CLIENT_SECRET"
            ],
          code: url.searchParams.get("code"),
          redirect_uri: `${appOrigin()}/api/connect/${provider}/callback`,
        }),
      },
    );
    const tokens = await r.json();
    if (!r.ok || !tokens.access_token)
      throw new HttpError(
        400,
        "Provider authorization failed. Check the app configuration and reconnect.",
      );
    jar.set(
      `devsync_pending_${provider}`,
      encrypt({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined,
      }),
      {
        httpOnly: true,
        secure: appOrigin().startsWith("https:"),
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      },
    );
    return NextResponse.redirect(`${appOrigin()}/connect/${provider}`);
  } catch (e) {
    return connectionErrorRedirect(e);
  }
}
