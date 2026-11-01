import { signupInput, authFailure } from "@/lib/auth";
import { assertPasswordSignupEnabled } from "@/lib/server/auth-settings";
import { readJson } from "@/lib/server/http";
import {
  apiError,
  assertOrigin,
  HttpError,
  userClient,
} from "@/lib/server/supabase";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const parsed = signupInput.safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(
        400,
        "Enter your name, a valid email, and a password with at least 12 characters.",
      );
    await assertPasswordSignupEnabled();
    const db = await userClient();
    const { data, error } = await db.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { data: { full_name: parsed.data.name } },
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
        409,
        "Your account needs activation before sign-in. Contact your workspace administrator.",
      );
    return Response.json(
      { signedIn: true },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
