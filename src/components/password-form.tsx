"use client";
import { useState } from "react";
import Link from "next/link";
export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <main className="password-page">
      <section className="login-card">
        <span className="login-welcome">DEVSYNC · ACCOUNT SECURITY</span>
        <h1>{done ? "Password updated" : "Choose a new password"}</h1>
        <p>
          {done
            ? "Your new password is ready to use."
            : "Choose a unique password with at least 12 characters."}
        </p>
        {done ? (
          <Link className="button button-primary" href="/">
            Continue to workspace
          </Link>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setError("");
              if (password !== confirmation) {
                setError("Your passwords don’t match.");
                return;
              }
              setBusy(true);
              try {
                const r = await fetch("/auth/password", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                  signal: AbortSignal.timeout(20000),
                });
                const body = await r.json().catch(() => ({}));
                if (!r.ok)
                  throw new Error(
                    body.error || "Unable to update your password.",
                  );
                setPassword("");
                setConfirmation("");
                setDone(true);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Unable to update your password.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
            />
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={busy}
            />
            <button className="button button-primary" disabled={busy}>
              {busy ? "Updating…" : "Save password"}
            </button>
          </form>
        )}
        {error && (
          <p role="alert" className="login-message error">
            {error}
          </p>
        )}
        {!done && (
          <Link href="/settings" className="demo-login">
            Back to settings
          </Link>
        )}
      </section>
    </main>
  );
}
