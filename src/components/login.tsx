"use client";
import { useState } from "react";
import Link from "next/link";
import { GitBranch, ArrowRight, LoaderCircle } from "lucide-react";
export function Login({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <div className="login-card">
        <Link href="/demo" className="brand">
          <span className="brand-symbol">
            <GitBranch size={21} />
          </span>
          devsync<span className="brand-dot">.</span>
        </Link>
        <h1>Bring your work together.</h1>
        <p>
          One place for your plans, pull requests, and the evidence that
          connects them.
        </p>
        {configured ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const r = await fetch("/auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email }),
                });
                const body = await r.json();
                setError(!r.ok);
                setMessage(body.message || body.error);
              } catch {
                setError(true);
                setMessage(
                  "Unable to send your sign-in link. Please try again.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="button button-primary" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <>
                  Email me a sign-in link
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="setup-instructions">
            <strong>Your Supabase connection is next.</strong>
            <p>
              Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in{" "}
              <code>.env.local</code>, then apply the included migration to
              enable sign-in.
            </p>
          </div>
        )}
        {message && (
          <div
            role="status"
            className={`login-message ${error ? "error" : ""}`}
          >
            {message}
          </div>
        )}
        <Link className="demo-login" href="/demo">
          Explore the demo workspace →
        </Link>
      </div>
    </main>
  );
}
