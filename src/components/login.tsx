"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GitBranch,
  GitPullRequest,
  ShieldCheck,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
export function Login({
  configured,
  initialError,
  mode = "signin",
}: {
  configured: boolean;
  initialError?: string;
  mode?: "signin" | "signup";
}) {
  const signup = mode === "signup";
  const [name, setName] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError || "");
  async function submit() {
    if (busy) return;
    if (signup && password !== confirmation) {
      setError("Your passwords don’t match. Please check them.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(signup ? "/auth/signup" : "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          signup
            ? { name: name.trim(), email: email.trim(), password }
            : { mode: "signin", email: email.trim(), password },
        ),
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.signedIn)
        throw new Error(body.error || "Unable to sign in. Try again shortly.");
      setPassword("");
      window.location.assign("/");
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "The request timed out. Check your connection and try again.",
      );
      setBusy(false);
    }
  }
  return (
    <main className="login-page auth-page">
      <section className="login-story" aria-label="About DevSync">
        <Link className="brand" href="/demo">
          <span className="brand-symbol">
            <GitBranch size={23} />
          </span>
          devsync.
        </Link>
        <div className="login-kicker">
          <span /> YOUR ENGINEERING WORKSPACE
        </div>
        <h2>
          Less chasing.
          <br />
          More shipping.
        </h2>
        <p>
          Your Jira plans and GitHub activity, connected. Give every pull
          request the context it deserves.
        </p>
        <div className="auth-preview" aria-label="Example connected workflow">
          <div className="auth-preview-top">
            <span className="health-light" data-healthy="true" /> A CONNECTED
            WORKFLOW <small>Example</small>
          </div>
          <div className="auth-preview-item">
            <span className="auth-source-icon">◆</span>
            <div>
              <small>JIRA · ENG-142</small>
              <strong>Add workspace permissions</strong>
            </div>
            <span className="auth-badge">In review</span>
          </div>
          <div className="auth-connector">
            <GitBranch size={14} /> Linked by issue key
          </div>
          <div className="auth-preview-item">
            <span className="auth-source-icon">
              <GitPullRequest size={20} />
            </span>
            <div>
              <small>GITHUB · PR #248</small>
              <strong>Workspace permission checks</strong>
            </div>
          </div>
          <div className="auth-preview-bottom">
            <span>
              <Check size={14} /> Checks passing
            </span>
            <span>
              <Check size={14} /> Review approved
            </span>
          </div>
        </div>
        <div className="login-trust">
          <ShieldCheck size={17} /> Private workspace · You choose what to
          connect
        </div>
      </section>
      <section className="login-card auth-card" aria-label="Account access">
        <span className="login-welcome">WELCOME TO DEVSYNC</span>
        <nav className="auth-tabs" aria-label="Account access options">
          <Link href="/login" aria-current={!signup ? "page" : undefined}>
            Sign in
          </Link>
          <Link href="/signup" aria-current={signup ? "page" : undefined}>
            Create account
          </Link>
        </nav>
        <h1>{signup ? "Create your account" : "Welcome back"}</h1>
        <p>
          {signup
            ? "Your own workspace, one password away. Connect your tools once you’re in."
            : "Sign in to open your workspace."}
        </p>
        {configured && (
          <>
            {/* A plain form POST so the server sets the PKCE cookie. */}
            <form
              action="/auth/google"
              method="post"
              onSubmit={() => setBusy(true)}
            >
              <button
                className="button auth-google"
                disabled={busy}
                aria-busy={busy}
              >
                <GoogleMark />
                Continue with Google
              </button>
            </form>
            <div className="auth-divider" role="separator">
              <span>or</span>
            </div>
          </>
        )}
        {!configured ? (
          <div className="login-message error" role="alert">
            Sign-in is not available yet. Please contact the workspace
            administrator.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {signup && (
              <>
                <label htmlFor="full-name">Your name</label>
                <input
                  id="full-name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={80}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={busy}
                />
              </>
            )}
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              aria-describedby={error ? "auth-error" : undefined}
            />
            <label htmlFor="password">Password</label>
            <div className="password-input">
              <input
                id="password"
                type={visible ? "text" : "password"}
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 12 : 1}
                maxLength={128}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                aria-describedby={error ? "auth-error" : undefined}
              />
              <button
                type="button"
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
                disabled={busy}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {signup ? (
              <>
                <p className="auth-field-help">
                  Use at least 12 characters. A unique passphrase works well.
                </p>
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type={visible ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  disabled={busy}
                />
              </>
            ) : (
              <Link href="/forgot-password" className="auth-text-button">
                Forgot password?
              </Link>
            )}
            <button
              className="button button-primary"
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? (
                <>
                  <LoaderCircle size={16} className="spin" />{" "}
                  {signup ? "Creating account…" : "Signing in…"}
                </>
              ) : (
                <>
                  {signup ? "Create account" : "Sign in"}{" "}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        )}
        {error && (
          <div id="auth-error" role="alert" className="login-message error">
            <TriangleAlert size={16} />
            <span>{error}</span>
          </div>
        )}
        <p className="auth-field-help auth-switch">
          {signup ? "Already have an account? " : "New to DevSync? "}
          <Link href={signup ? "/login" : "/signup"}>
            {signup ? "Sign in" : "Create account"}
          </Link>
        </p>
        <p className="login-privacy">
          <ShieldCheck size={13} /> Your tools stay private to your account.
        </p>
        <Link className="demo-login" href="/demo">
          Explore a sample workspace <ArrowRight size={13} />
        </Link>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}
