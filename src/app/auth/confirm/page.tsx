import Link from "next/link";
import { EmailConfirmation } from "@/components/email-confirmation";
export const dynamic = "force-dynamic";
export const metadata = { referrer: "no-referrer" as const };
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const params = await searchParams;
  if (
    !params.token_hash ||
    !/^[a-f0-9]{32,128}$/i.test(params.token_hash) ||
    !["email", "signup", "magiclink", "recovery"].includes(params.type || "")
  )
    return (
      <main className="password-page">
        <section className="login-card">
          <h1>This link is incomplete</h1>
          <p>
            Sign in with your password, or ask your workspace administrator for
            help with account recovery.
          </p>
          <Link href="/login" className="button button-primary">
            Back to sign in
          </Link>
        </section>
      </main>
    );
  return (
    <EmailConfirmation tokenHash={params.token_hash} type={params.type!} />
  );
}
