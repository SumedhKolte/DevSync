import { notFound, redirect } from "next/navigation";
import { resolveView } from "@/lib/views";
import { currentUser, isConfigured } from "@/lib/server/supabase";
// Runs before loading.tsx starts streaming, so 404s and sign-in redirects keep
// real HTTP status codes instead of a streamed 200 with a client redirect.
export default async function ViewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ view?: string[] }>;
}) {
  const route = resolveView((await params).view);
  if (!route) notFound();
  if (!route.demo && (!isConfigured() || !(await currentUser())))
    redirect("/login");
  return children;
}
