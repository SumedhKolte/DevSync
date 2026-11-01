import { redirect } from "next/navigation";
import { Login } from "@/components/login";
import { isConfigured, userClient } from "@/lib/server/supabase";
// Session-dependent: render per request, never at build time.
export const dynamic = "force-dynamic";
export const metadata = { title: "Create account · DevSync" };
export default async function SignupPage() {
  if (isConfigured()) {
    const {
      data: { user },
    } = await (await userClient()).auth.getUser();
    if (user) redirect("/");
  }
  return <Login configured={isConfigured()} mode="signup" />;
}
