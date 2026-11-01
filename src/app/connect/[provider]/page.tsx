import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { githubAppSlug, jiraSites } from "@/lib/oauth";
import { decrypt } from "@/lib/server/crypto";
import { getPendingTokens } from "@/lib/server/pending-tokens";
import {
  githubPages,
  providerFetch,
  type ProviderTokens,
} from "@/lib/server/providers";
import { userClient } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
async function accountOptions(provider: string, secret: string) {
  const tokens = decrypt<ProviderTokens>(secret);
  return provider === "github"
    ? (
        await githubPages<{ id: number; account: { login: string } }>(
          "/user/installations",
          tokens.access_token,
          "installations",
        )
      ).map((i) => ({ id: String(i.id), name: i.account.login }))
    : jiraSites(
        (
          await providerFetch<
            { id: string; name: string; url: string; scopes: string[] }[]
          >(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            tokens.access_token,
          )
        ).data,
      ).map((s) => ({ id: s.id, name: s.name }));
}
export default async function SelectAccount({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const {
    data: { user },
  } = await (await userClient()).auth.getUser();
  if (!user) redirect("/login");
  const { provider } = await params;
  if (!["github", "jira"].includes(provider)) notFound();
  const secret = getPendingTokens(await cookies(), provider);
  if (!secret) redirect("/connections");
  const slug = githubAppSlug(process.env.GITHUB_APP_SLUG || "");
  const options = await accountOptions(provider, secret).catch(() => null);
  if (!options) redirect("/connect/error?reason=authorization");
  return (
    <main className="login-page">
      <div className="login-card">
        <h1>
          Choose your{" "}
          {provider === "jira" ? "Jira site" : "GitHub installation"}.
        </h1>
        <p>
          Only resources available to your authorizing account will be imported.
        </p>
        <form action={`/api/connect/${provider}/select`} method="post">
          <div className="scope-options">
            {options.map((o) => (
              <label key={o.id}>
                <input type="radio" name="account" value={o.id} required />
                {o.name}
              </label>
            ))}
          </div>
          {options.length > 0 && (
            <button className="button button-primary">
              Connect selected account
            </button>
          )}
        </form>
        {!options.length && (
          <p role="status">
            No accessible{" "}
            {provider === "github" ? "GitHub installations" : "Jira sites"} were
            found. Check access with your organization administrator, then
            reconnect your account.
          </p>
        )}
        {provider === "github" && slug && (
          <a
            className="demo-login"
            href={`https://github.com/apps/${slug}/installations/new`}
          >
            Install DevSync on another account →
          </a>
        )}
        <Link href={`/connect/${provider}/setup`} className="demo-login">
          Review connection requirements
        </Link>
        <Link href="/connections" className="demo-login">
          Back to connections
        </Link>
      </div>
    </main>
  );
}
