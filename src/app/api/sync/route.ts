import {
  apiError,
  assertOrigin,
  requireUser,
  HttpError,
} from "@/lib/server/supabase";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const { db } = await requireUser();
    const { data, error } = await db.from("connections").select("id,resources");
    if (error) throw error;
    const active = (data || []).filter(
      (c) => Array.isArray(c.resources) && c.resources.length,
    );
    if (!active.length)
      throw new HttpError(
        400,
        "Connect your accounts and select resources before refreshing.",
      );
    for (const c of active) {
      const { error } = await db.rpc("enqueue_sync", { p_id: c.id });
      if (error) throw error;
    }
    return Response.json({ queued: active.length });
  } catch (e) {
    return apiError(e);
  }
}
