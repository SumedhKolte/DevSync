import { apiError, assertOrigin } from "@/lib/server/supabase";
import { ownedConnection } from "@/lib/server/connection";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const { id } = await params;
    const { db } = await ownedConnection(id);
    const { error } = await db.rpc("remove_connection", { p_id: id });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
