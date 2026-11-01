import { redirect } from "next/navigation";
import { isConfigured, userClient } from "@/lib/server/supabase";
import { PasswordForm } from "@/components/password-form";
// Session-dependent: render per request, never at build time.
export const dynamic = "force-dynamic";
export default async function PasswordPage() {
  if (!isConfigured()) redirect("/login");
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return <PasswordForm />;
}
