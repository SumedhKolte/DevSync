import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { appOrigin, userClient } from "@/lib/server/supabase";
import { githubAppSlug, jiraScopes } from "@/lib/oauth";
export const dynamic = "force-dynamic";
export default async function Setup({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const {
    data: { user },
  } = await (await userClient()).auth.getUser();
  if (!user) redirect("/login");
  const { provider } = await params;
  if (provider !== "github" && provider !== "jira") notFound();
  const github = provider === "github",
    label = github ? "GitHub" : "Jira";
  const missing = [
    "TOKEN_ENCRYPTION_KEY",
    github ? "GITHUB_CLIENT_ID" : "JIRA_CLIENT_ID",
    github ? "GITHUB_CLIENT_SECRET" : "JIRA_CLIENT_SECRET",
  ].filter((key) => !process.env[key]?.trim());
  const slug = githubAppSlug(process.env.GITHUB_APP_SLUG || "");
  let appStatus = "unverified";
  if (github && slug) {
    try {
      const response = await fetch(`https://api.github.com/apps/${slug}`, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const app = await response.json();
        appStatus =
          app.client_id === process.env.GITHUB_CLIENT_ID?.trim()
            ? "matched"
            : "mismatch";
      } else if (response.status === 404) appStatus = "not-found";
    } catch {
      /* Report an unverified check without blocking a private app. */
    }
  }
  const blocked =
    missing.length > 0 || appStatus === "mismatch" || (github && !slug);
  return (
    <main className="password-page">
      <section className="login-card integration-setup">
        <span className="login-welcome">DEVSYNC · INTEGRATION SETUP</span>
        <h1>Connect {label}</h1>
        <p>Check these requirements before authorizing your account.</p>
        {missing.length > 0 && (
          <p role="alert">
            The server is missing: {missing.join(", ")}. Ask your workspace
            administrator to finish configuration.
          </p>
        )}
        <h2>Callback URL</h2>
        <p>Register this exact URL in your {label} app settings:</p>
        <code className="setup-callback">
          {appOrigin()}/api/connect/{provider}/callback
        </code>
        {github ? (
          <>
            <h2>App and installation</h2>
            {appStatus === "matched" && (
              <p role="status">
                The public app matches the configured client ID.
              </p>
            )}
            {appStatus === "mismatch" && (
              <p role="alert">
                The app slug and OAuth client ID belong to different
                registrations. Correct them before continuing.
              </p>
            )}
            {(!slug || appStatus === "not-found") && (
              <p role="alert">
                {!slug
                  ? "The GitHub App slug is missing or invalid."
                  : "GitHub returned 404 for the configured app page. Confirm the slug in your app settings. A private app may require the app owner’s account."}
              </p>
            )}
            <p>
              Authorize using the GitHub App’s Client ID, then install that same
              app on the account or organization whose repositories you want to
              import.
            </p>
            <a
              className="demo-login"
              href="https://github.com/settings/apps"
              target="_blank"
              rel="noreferrer"
            >
              Open GitHub App settings
            </a>
            {slug && (
              <a
                className="demo-login"
                href={`https://github.com/apps/${slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Check configured app page
              </a>
            )}
          </>
        ) : (
          <>
            <h2>Jira site access</h2>
            <p>
              Your Atlassian developer account alone is not enough. Use an
              account that can open a Jira Cloud site and browse its projects.
              Jira Software access is needed for board and sprint features.
            </p>
            <p>
              If Atlassian says “This app requires access to a Jira site,” check
              your account’s Jira product access with the site administrator. If
              other people use your OAuth app, its Distribution settings must
              allow sharing.
            </p>
            <h2>App permissions</h2>
            <p>Add these scopes to the OAuth app before authorization:</p>
            <code className="setup-callback">{jiraScopes.join(" ")}</code>
            <a
              className="demo-login"
              href="https://developer.atlassian.com/console/myapps/"
              target="_blank"
              rel="noreferrer"
            >
              Open Atlassian developer console
            </a>
          </>
        )}
        {!blocked && (
          <a
            className="button button-primary"
            href={`/api/connect/${provider}`}
          >
            Continue to {label}
          </a>
        )}
        <Link href="/connections" className="demo-login">
          Back to connections
        </Link>
      </section>
    </main>
  );
}
