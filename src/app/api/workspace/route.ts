import { readJson } from "@/lib/server/http";
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
    const { db } = await requireUser();
    const parsed = z
      .object({ name: z.string().trim().min(2).max(80) })
      .safeParse(await readJson(request));
    if (!parsed.success)
      throw new HttpError(400, "Workspace names must be 2–80 characters.");
    const { data: workspaceId, error: bootstrapError } =
      await db.rpc("ensure_workspace");
    if (bootstrapError) throw bootstrapError;
    const { error } = await db
      .from("workspaces")
      .update({ name: parsed.data.name })
      .eq("id", workspaceId)
      .select("id")
      .single();
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
