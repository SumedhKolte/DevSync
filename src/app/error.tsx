"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>We couldn’t load your workspace.</h1>
      <p>
        Your workspace is temporarily unavailable. Try again in a moment, or
        sign in again if your session has expired.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
      <Link className="button" href="/login">
        Back to sign in
      </Link>
    </main>
  );
}
