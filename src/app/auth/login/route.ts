import { readJson } from "@/lib/server/http";
import { authInput, authFailure } from "@/lib/auth";
import {
  apiError,
  assertOrigin,
  HttpError,
  userClient,
} from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const parsed = authInput.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "Sign in with a valid email and password.");
    const db = await userClient();
    const { data, error } = await db.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      const failure = authFailure(error);
      return Response.json(failure, {
        status: failure.status,
        headers: { "Cache-Control": "no-store" },
      });
    }
    if (!data.session)
      throw new HttpError(
        503,
        "Unable to start your session. Please try again.",
      );
    return Response.json(
      { signedIn: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
