import { z } from "zod";
import { readJson } from "@/lib/server/http";
import {
  apiError,
  assertOrigin,
  userClient,
  HttpError,
} from "@/lib/server/supabase";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const input = z
      .object({
        tokenHash: z.string().regex(/^[a-f0-9]{32,128}$/i),
        type: z.enum(["email", "signup", "magiclink", "recovery"]),
      })
      .safeParse(await readJson(request));
    if (!input.success)
      throw new HttpError(
        400,
        "This confirmation link is invalid. Request a new one.",
      );
    const db = await userClient();
    const { error } = await db.auth.verifyOtp({
      token_hash: input.data.tokenHash,
      type: input.data.type,
    });
    if (error)
      throw new HttpError(
        error.status === 429 ? 429 : 400,
        "This link has expired or has already been used. Sign in with your password, or contact your workspace administrator for a new recovery link.",
      );
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
