import Link from "next/link";
export default async function ConnectionError({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return (
    <main className="password-page">
      <section className="login-card">
        <span className="login-welcome">DEVSYNC · CONNECTIONS</span>
        <h1>Let’s reconnect your account</h1>
        <p role="alert">
          {reason === "configuration"
            ? "This integration isn’t configured yet. Ask your workspace administrator to finish the GitHub or Jira app setup, then try again."
            : "Authorization was cancelled, expired, or could not be completed. Return to Connections and start again."}
        </p>
        <Link href="/connections" className="button button-primary">
          Back to connections
        </Link>
        <Link href="/" className="demo-login">
          Go to overview
        </Link>
      </section>
    </main>
  );
}
