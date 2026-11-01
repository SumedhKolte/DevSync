import { NextResponse } from "next/server";
import { userClient, appOrigin } from "@/lib/server/supabase";
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (code) {
    const db = await userClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(appOrigin());
  }
  return NextResponse.redirect(`${appOrigin()}/login?error=invalid-link`);
}
