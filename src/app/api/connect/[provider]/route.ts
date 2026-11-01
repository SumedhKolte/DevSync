import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  apiError,
  appOrigin,
  HttpError,
  requireUser,
} from "@/lib/server/supabase";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    await requireUser();
    const { provider } = await params;
    if (!["github", "jira"].includes(provider))
      throw new HttpError(404, "Unknown provider.");
    if (
      !process.env.TOKEN_ENCRYPTION_KEY ||
      !process.env[provider === "jira" ? "JIRA_CLIENT_ID" : "GITHUB_CLIENT_ID"]
    )
      throw new HttpError(
        503,
        `Configure ${provider === "jira" ? "Jira OAuth" : "GitHub App OAuth"} and the token encryption key on the server first.`,
      );
    const state = randomBytes(32).toString("hex");
    const jar = await cookies();
    jar.set(`devsync_oauth_${provider}`, state, {
      httpOnly: true,
      secure: appOrigin().startsWith("https:"),
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    const url = new URL(
      provider === "jira"
        ? "https://auth.atlassian.com/authorize"
        : "https://github.com/login/oauth/authorize",
    );
    url.searchParams.set(
      "client_id",
      process.env[provider === "jira" ? "JIRA_CLIENT_ID" : "GITHUB_CLIENT_ID"]!,
    );
    url.searchParams.set("state", state);
    url.searchParams.set(
      "redirect_uri",
      `${appOrigin()}/api/connect/${provider}/callback`,
    );
    if (provider === "jira") {
      url.searchParams.set("audience", "api.atlassian.com");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("prompt", "consent");
      url.searchParams.set(
        "scope",
        "read:jira-work read:jira-user manage:jira-webhook offline_access read:board-scope:jira-software read:sprint:jira-software",
      );
    }
    return NextResponse.redirect(url);
  } catch (e) {
    return apiError(e);
  }
}
