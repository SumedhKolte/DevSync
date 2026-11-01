import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { decrypt } from "@/lib/server/crypto";
import {
  githubPages,
  providerFetch,
  type ProviderTokens,
} from "@/lib/server/providers";
import { requireUser } from "@/lib/server/supabase";
export const dynamic = "force-dynamic";
export default async function SelectAccount({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  await requireUser();
  const { provider } = await params;
  if (!["github", "jira"].includes(provider)) notFound();
  const secret = (await cookies()).get(`devsync_pending_${provider}`)?.value;
  if (!secret) redirect("/connections");
  const tokens = decrypt<ProviderTokens>(secret);
  const options =
    provider === "github"
      ? (
          await githubPages<{ id: number; account: { login: string } }>(
            "/user/installations",
            tokens.access_token,
            "installations",
          )
        ).map((i) => ({ id: String(i.id), name: i.account.login }))
      : (
          await providerFetch<{ id: string; name: string }[]>(
            "https://api.atlassian.com/oauth/token/accessible-resources",
            tokens.access_token,
          )
        ).data.map((s) => ({ id: s.id, name: s.name }));
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
        {provider === "github" && process.env.GITHUB_APP_SLUG && (
          <a
            className="demo-login"
            href={`https://github.com/apps/${encodeURIComponent(process.env.GITHUB_APP_SLUG)}/installations/new`}
          >
            Install DevSync on another account →
          </a>
        )}
        <Link href="/connections" className="demo-login">
          Back to connections
        </Link>
      </div>
    </main>
  );
}
