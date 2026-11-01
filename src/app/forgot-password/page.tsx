import Link from "next/link";
export const metadata = { title: "Account help · DevSync" };
export default function AccountHelp() {
  return (
    <main className="password-page">
      <section className="login-card">
        <span className="login-welcome">DEVSYNC · ACCOUNT HELP</span>
        <h1>Get back to your workspace</h1>
        <p>
          DevSync uses a password for sign-in. It does not send login or
          password-reset emails.
        </p>
        <h2>Forgot your password?</h2>
        <p>
          If you’re signed in on another device, change your password in
          Settings. Otherwise, ask your workspace administrator for a one-time
          password setup link after they verify your identity.
        </p>
        <h2>New to DevSync?</h2>
        <p>
          Create an account with your email and a password to start your own
          workspace.
        </p>
        <Link href="/signup" className="button button-primary">
          Create account
        </Link>
        <Link href="/login" className="demo-login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
