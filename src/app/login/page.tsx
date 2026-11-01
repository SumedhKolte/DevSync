import { isConfigured } from "@/lib/server/supabase";
import { Login } from "@/components/login";
export default function LoginPage() {
  return <Login configured={isConfigured()} />;
}
