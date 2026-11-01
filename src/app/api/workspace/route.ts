import { z } from "zod";
import {
  apiError,
  assertOrigin,
  requireUser,
  HttpError,
} from "@/lib/server/supabase";
export async function PATCH(request: Request) {
  try {
    assertOrigin(request);
    const { db, user } = await requireUser();
    const parsed = z
      .object({ name: z.string().trim().min(2).max(80) })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(400, "Workspace names must be 2–80 characters.");
    const { error } = await db
      .from("workspaces")
      .update({ name: parsed.data.name })
      .eq("owner_id", user.id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
