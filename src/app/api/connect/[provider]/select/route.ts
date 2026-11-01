import { jiraSites, type AtlassianResource } from "@/lib/oauth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decrypt } from "@/lib/server/crypto";
import {
  githubPages,
  providerFetch,
  type ProviderTokens,
} from "@/lib/server/providers";
import { connectionErrorRedirect } from "@/lib/server/connection-redirect";
import {
  clearPendingTokens,
  getPendingTokens,
} from "@/lib/server/pending-tokens";
import {
  appOrigin,
  assertOrigin,
  HttpError,
  requireUser,
} from "@/lib/server/supabase";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  try {
    assertOrigin(request);
    const { db } = await requireUser();
    const { provider } = await params;
    if (!["github", "jira"].includes(provider))
      throw new HttpError(404, "Unknown provider");
    const jar = await cookies();
    const secret = getPendingTokens(jar, provider);
    if (!secret)
      throw new HttpError(
        400,
        "Authorization expired. Reconnect your account.",
      );
    const tokens = decrypt<ProviderTokens>(secret);
    const account = String((await request.formData()).get("account") || "");
    let label: string;
    let config: Record<string, string | number>;
    if (provider === "github") {
      const installations = await githubPages<{
        id: number;
        account: { login: string };
      }>("/user/installations", tokens.access_token, "installations");
      const chosen = installations.find((i) => String(i.id) === account);
      if (!chosen)
        throw new HttpError(
          403,
          "Installation not accessible to your account.",
        );
      label = chosen.account.login;
      config = { installation_id: chosen.id };
    } else {
      const { data: sites } = await providerFetch<AtlassianResource[]>(
        "https://api.atlassian.com/oauth/token/accessible-resources",
        tokens.access_token,
      );
      const chosen = jiraSites(sites).find((s) => s.id === account);
      if (!chosen)
        throw new HttpError(403, "Site not accessible to your account.");
      label = new URL(chosen.url).hostname;
      config = { cloud_id: chosen.id, site_url: chosen.url };
    }
    const { error } = await db.rpc("save_connection", {
      p_provider: provider,
      p_account_id: account,
      p_label: label,
      p_config: config,
      p_ciphertext: secret,
    });
    if (error) throw error;
    clearPendingTokens(jar, provider);
    return NextResponse.redirect(`${appOrigin()}/connections`, 303);
  } catch (e) {
    return connectionErrorRedirect(e);
  }
}
