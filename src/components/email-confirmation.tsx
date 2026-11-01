"use client";
import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
export function EmailConfirmation({
  tokenHash,
  type,
}: {
  tokenHash: string;
  type: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="password-page">
      <section className="login-card">
        <div className="auth-mail-icon">
          <MailCheck size={28} />
        </div>
        <span className="login-welcome">DEVSYNC · SECURE SIGN-IN</span>
        <h1>
          {type === "recovery" ? "Reset your password" : "You’re one step away"}
        </h1>
        <p>
          Confirm to{" "}
          {type === "recovery"
            ? "choose a new password"
            : "open your private workspace"}
          . This link can be used once.
        </p>
        <button
          className="button button-primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tokenHash, type }),
                signal: AbortSignal.timeout(20000),
              });
              const body = await r.json().catch(() => ({}));
              if (!r.ok)
                throw new Error(body.error || "Unable to confirm this link.");
              window.location.replace(type === "recovery" ? "/password" : "/");
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Unable to confirm this link.",
              );
              setBusy(false);
            }
          }}
        >
          {busy ? "Confirming…" : "Continue securely"}
        </button>
        {error && (
          <p className="login-message error" role="alert">
            {error}
          </p>
        )}
        <Link className="demo-login" href="/login">
          Back to sign in
        </Link>
      </section>
    </main>
  );
}
