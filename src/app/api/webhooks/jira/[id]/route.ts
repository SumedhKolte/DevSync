import { jwtVerify } from "jose";
import { createHash } from "node:crypto";
import { adminClient } from "@/lib/server/supabase";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const secret = process.env.JIRA_CLIENT_SECRET;
  if (!secret) return new Response(null, { status: 503 });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return new Response(null, { status: 401 });
  try {
    await jwtVerify(authorization.slice(7), new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
  } catch {
    return new Response(null, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.text();
    if (body.length > 2 * 1024 * 1024)
      return new Response(null, { status: 413 });
    const event = JSON.parse(body);
    const db = adminClient();
    const { data: connection } = await db
      .from("connections")
      .select("id,provider")
      .eq("id", id)
      .single();
    if (connection?.provider !== "jira")
      return new Response(null, { status: 404 });
    const delivery =
      request.headers.get("x-atlassian-webhook-identifier") ||
      createHash("sha256").update(body).digest("hex");
    if (!event.webhookEvent) return new Response(null, { status: 400 });
    const { error } = await db.rpc("ingest_delivery", {
      p_provider: "jira",
      p_delivery_id: delivery,
      p_connection_id: id,
    });
    if (error) throw error;
    return new Response(null, { status: 202 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
