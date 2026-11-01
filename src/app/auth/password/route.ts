import { z } from "zod";
import { readJson } from "@/lib/server/http";
import {
  apiError,
  assertOrigin,
  requireUser,
  HttpError,
} from "@/lib/server/supabase";
import { authFailure } from "@/lib/auth";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { db } = await requireUser();
    const input = z
      .object({ password: z.string().min(12).max(128) })
      .safeParse(await readJson(request));
    if (!input.success)
      throw new HttpError(400, "Use a password with at least 12 characters.");
    const { error } = await db.auth.updateUser({
      password: input.data.password,
    });
    if (error) {
      const failure = authFailure(error);
      return Response.json(failure, { status: failure.status });
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
