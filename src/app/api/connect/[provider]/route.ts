import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appOrigin, HttpError, requireUser } from "@/lib/server/supabase";
import { connectionErrorRedirect } from "@/lib/server/connection-redirect";
import { authorizationUrl, type IntegrationProvider } from "@/lib/oauth";
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
      !process.env[
        provider === "jira" ? "JIRA_CLIENT_ID" : "GITHUB_CLIENT_ID"
      ] ||
      !process.env[
        provider === "jira" ? "JIRA_CLIENT_SECRET" : "GITHUB_CLIENT_SECRET"
      ]
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
    return NextResponse.redirect(
      authorizationUrl(
        provider as IntegrationProvider,
        process.env[
          provider === "jira" ? "JIRA_CLIENT_ID" : "GITHUB_CLIENT_ID"
        ]!,
        appOrigin(),
        state,
      ),
    );
  } catch (e) {
    return connectionErrorRedirect(e);
  }
}
