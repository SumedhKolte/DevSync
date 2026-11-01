import { redirect } from "next/navigation";
import { isConfigured, userClient } from "@/lib/server/supabase";
import { Login } from "@/components/login";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (isConfigured()) {
    const db = await userClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (user) redirect("/");
  }
  return (
    <Login
      configured={isConfigured()}
      initialError={
        error === "invalid-link"
          ? "Email-link sign-in is no longer offered. Please sign in with your email and password."
          : undefined
      }
    />
  );
}
