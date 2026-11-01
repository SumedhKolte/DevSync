import { z } from "zod";
import { apiError, assertOrigin, HttpError } from "@/lib/server/supabase";
import { ownedConnection, withConnectionToken } from "@/lib/server/connection";
import { listResources } from "@/lib/server/providers";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { connection } = await ownedConnection(id);
    const resources = await withConnectionToken(connection, (token) =>
      listResources(connection, token),
    );
    return Response.json({
      resources,
      selected: connection.resources.map((r) => r.id),
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertOrigin(request);
    const parsed = z
      .object({ resources: z.array(z.string().min(1).max(100)).max(20) })
      .safeParse(await request.json());
    if (!parsed.success)
      throw new HttpError(400, "Choose up to 20 valid resources.");
    const { id } = await params;
    const { db, connection } = await ownedConnection(id);
    const resources = await withConnectionToken(connection, (token) =>
      listResources(connection, token),
    );
    const selected = resources.filter((r) =>
      parsed.data.resources.includes(r.id),
    );
    if (selected.length !== new Set(parsed.data.resources).size)
      throw new HttpError(
        403,
        "One or more resources are no longer accessible.",
      );
    const { error } = await db.rpc("set_connection_scope", {
      p_id: id,
      p_resources: selected,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
