"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>We couldn’t load your workspace.</h1>
      <p>
        Your data hasn’t been replaced with sample records. Check your Supabase
        connection and migrations, then try again.
      </p>
      <button className="button button-primary" onClick={reset}>
        Try again
      </button>
      <Link className="button" href="/demo">
        Explore the demo
      </Link>
    </main>
  );
}
