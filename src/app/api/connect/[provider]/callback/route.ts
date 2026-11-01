import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { encrypt } from "@/lib/server/crypto";
import { appOrigin, HttpError, requireUser } from "@/lib/server/supabase";
import { connectionErrorRedirect } from "@/lib/server/connection-redirect";
import {
  getPendingTokens,
  setPendingTokens,
} from "@/lib/server/pending-tokens";
// Provider error codes are short identifiers, e.g. redirect_uri_mismatch.
const providerCode = (value: unknown) =>
  typeof value === "string"
    ? value.replace(/[^\w .:-]/g, "").slice(0, 120)
    : "";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  let detail: string | undefined;
  try {
    await requireUser();
    const { provider } = await params;
    if (!["github", "jira"].includes(provider))
      throw new HttpError(404, "Unknown provider");
    const url = new URL(request.url);
    const jar = await cookies();
    if (provider === "github" && url.searchParams.has("installation_id"))
      return NextResponse.redirect(
        `${appOrigin()}${getPendingTokens(jar, "github") ? "/connect/github" : "/api/connect/github"}`,
      );
    const expected = jar.get(`devsync_oauth_${provider}`)?.value;
    const state = url.searchParams.get("state");
    jar.delete(`devsync_oauth_${provider}`);
    // Providers send people back with ?error=… when they reject the request.
    const rejected = providerCode(url.searchParams.get("error"));
    if (rejected) {
      const description = providerCode(
        url.searchParams.get("error_description"),
      );
      detail = description ? `${rejected}: ${description}` : rejected;
    } else if (!expected) detail = "sign-in state cookie missing or expired";
    else if (state !== expected) detail = "state did not match this browser";
    else if (!url.searchParams.get("code")) detail = "no authorization code";
    if (detail)
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
    const tokens = await r.json().catch(() => ({}));
    if (!r.ok || !tokens.access_token) {
      const code = providerCode(tokens.error) || `HTTP ${r.status}`;
      const description = providerCode(tokens.error_description);
      detail = `token exchange failed (${code}${description ? `: ${description}` : ""})`;
      throw new HttpError(
        400,
        "Provider authorization failed. Check the app configuration and reconnect.",
      );
    }
    setPendingTokens(
      jar,
      provider,
      encrypt({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expires_in
          ? Date.now() + tokens.expires_in * 1000
          : undefined,
      }),
      { secure: appOrigin().startsWith("https:") },
    );
    return NextResponse.redirect(`${appOrigin()}/connect/${provider}`);
  } catch (e) {
    if (detail)
      console.warn(JSON.stringify({ event: "oauth.callback_failed", detail }));
    return connectionErrorRedirect(e, detail);
  }
}
