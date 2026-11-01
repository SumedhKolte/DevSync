import type { Metadata } from "next";
import "./globals.css";
import "./product.css";
export const metadata: Metadata = {
  title: "DevSync — Your delivery, connected",
  description:
    "A clearer picture of software delivery. Connect Jira work items, GitHub pull requests, reviews, and CI evidence in one focused workspace.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
