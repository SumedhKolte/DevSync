import { redirect } from "next/navigation";
import { userClient } from "@/lib/server/supabase";
import { PasswordForm } from "@/components/password-form";
export default async function PasswordPage() {
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return <PasswordForm />;
}
