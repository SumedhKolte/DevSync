import { adminClient } from "@/lib/server/supabase";
import { verifyGithubSignature } from "@/lib/server/crypto";
export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret)
    return Response.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  const body = await request.text();
  if (body.length > 2 * 1024 * 1024) return new Response(null, { status: 413 });
  if (
    !verifyGithubSignature(
      body,
      request.headers.get("x-hub-signature-256"),
      secret,
    )
  )
    return new Response(null, { status: 401 });
  try {
    const event = JSON.parse(body);
    const delivery = request.headers.get("x-github-delivery");
    if (!delivery || !event.installation?.id)
      return new Response(null, { status: 400 });
    const db = adminClient();
    const { data, error } = await db
      .from("connections")
      .select("id")
      .eq("provider", "github")
      .eq("provider_account_id", String(event.installation.id));
    if (error) throw error;
    for (const c of data || []) {
      const { error } = await db.rpc("ingest_delivery", {
        p_provider: "github",
        p_delivery_id: delivery,
        p_connection_id: c.id,
      });
      if (error) throw error;
    }
    return new Response(null, { status: 202 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
