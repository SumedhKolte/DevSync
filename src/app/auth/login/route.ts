import { z } from "zod";
import {
  apiError,
  appOrigin,
  assertOrigin,
  HttpError,
  userClient,
} from "@/lib/server/supabase";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const parsed = z
      .object({ email: z.email().max(254) })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(400, "Enter a valid email address.");
    const db = await userClient();
    const { error } = await db.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: `${appOrigin()}/auth/callback` },
    });
    if (error)
      throw new HttpError(
        429,
        "Unable to send a link right now. Check the email address and try again shortly.",
      );
    return Response.json({
      message: "Check your email for a secure sign-in link.",
    });
  } catch (e) {
    return apiError(e);
  }
}
