import { adminClient, requireUser, HttpError } from "./supabase";
import { decrypt, encrypt } from "./crypto";
import {
  refreshTokens,
  type ConnectionRow,
  type ProviderTokens,
} from "./providers";
import { randomUUID } from "node:crypto";
import { connectionSchema } from "../validation";
export async function ownedConnection(id: string) {
  const { db, user } = await requireUser();
  const { data, error } = await db
    .from("connections")
    .select("*")
    .eq("id", id)
    .eq("owner_id", user.id)
    .single();
  if (error || !data) throw new HttpError(404, "Connection not found.");
  return { db, connection: connectionSchema.parse(data) };
}
export async function withConnectionToken<T>(
  connection: ConnectionRow,
  fn: (token: string) => Promise<T>,
) {
  const admin = adminClient();
  const lease = randomUUID();
  const { data: locked, error: lockError } = await admin.rpc("worker_lock", {
    p_id: connection.id,
    p_lease: lease,
  });
  if (lockError) throw lockError;
  if (!locked)
    throw new HttpError(
      409,
      "This connection is syncing. Please try again shortly.",
    );
  try {
    const { data: secret, error } = await admin.rpc("worker_secret", {
      p_id: connection.id,
    });
    if (error || !secret) throw new HttpError(409, "Reconnect this account.");
    const original = decrypt<ProviderTokens>(secret);
    const fresh = await refreshTokens(connection.provider, original);
    if (fresh !== original) {
      const { error: saveError } = await admin.rpc("worker_secret", {
        p_id: connection.id,
        p_ciphertext: encrypt(fresh),
      });
      if (saveError) throw saveError;
    }
    return await fn(fresh.access_token);
  } finally {
    await admin.rpc("worker_lock", {
      p_id: connection.id,
      p_lease: lease,
      p_release: true,
    });
  }
}
