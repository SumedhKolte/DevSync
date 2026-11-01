import Link from "next/link";
export const metadata = { title: "Page not found · DevSync" };
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>This page wandered off.</h1>
      <p>Return to your workspace to find the work that matters.</p>
      <Link href="/" className="button button-primary">
        Back to overview
      </Link>
    </main>
  );
}
