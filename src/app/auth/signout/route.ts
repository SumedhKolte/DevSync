import { NextResponse } from "next/server";
import {
  assertOrigin,
  appOrigin,
  userClient,
  apiError,
} from "@/lib/server/supabase";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const db = await userClient();
    await db.auth.signOut();
    return NextResponse.redirect(`${appOrigin()}/login`, 303);
  } catch (e) {
    return apiError(e);
  }
}
