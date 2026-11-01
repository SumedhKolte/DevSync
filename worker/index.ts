import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../src/lib/database.types";
import { retryDecision } from "../src/lib/server/retry";
import { withProviderBudget } from "../src/lib/server/provider-budget";
import { z } from "zod";
import { toJson, connectionSchema } from "../src/lib/validation";
import { decrypt, encrypt } from "../src/lib/server/crypto";
import { importGithub, importJira } from "../src/lib/server/importers";
import {
  ProviderError,
  refreshTokens,
  type ProviderTokens,
} from "../src/lib/server/providers";
import { ensureJiraWebhook } from "../src/lib/server/jira-webhooks";
const db = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
async function checked<T extends { error: unknown }>(
  promise: PromiseLike<T>,
): Promise<T> {
  const result = await promise;
  if (result.error) throw result.error;
  return result;
}
const log = (event: string, fields: Record<string, unknown> = {}) =>
  console.log(
    JSON.stringify({ event, at: new Date().toISOString(), ...fields }),
  );
async function job(message: {
  msg_id: number;
  read_ct: number;
  message: { connection_id: string };
}) {
  const id = message.message.connection_id;
  const lease = randomUUID();
  const { data: initial } = await checked(
    db.from("connections").select("*").eq("id", id).maybeSingle(),
  );
  if (!initial) {
    await checked(db.rpc("worker_ack", { p_msg_id: message.msg_id }));
    return;
  }
  const { data: acquired } = await checked(
    db.rpc("worker_lock", { p_id: id, p_lease: lease }),
  );
  if (!acquired) {
    await checked(
      db.rpc("worker_delay", { p_msg_id: message.msg_id, p_seconds: 60 }),
    );
    return;
  }
  let runId: string | undefined;
  let c = initial;
  const startedAt = new Date().toISOString();
  try {
    // Scope may have changed while waiting for the lease. Load it after acquiring.
    const { data: current } = await checked(
      db.from("connections").select("*").eq("id", id).maybeSingle(),
    );
    if (!current) {
      await checked(db.rpc("worker_ack", { p_msg_id: message.msg_id }));
      return;
    }
    c = current;
    const connection = connectionSchema.parse(c);
    const { data: run } = await checked(
      db
        .from("sync_runs")
        .insert({
          connection_id: id,
          workspace_id: c.workspace_id,
          status: "running",
        })
        .select("id")
        .single(),
    );
    runId = run!.id;
    const { data: secret } = await checked(
      db.rpc("worker_secret", { p_id: id }),
    );
    if (!secret) throw new ProviderError(401);
    const original = decrypt<ProviderTokens>(secret);
    const tokens = await refreshTokens(connection.provider, original);
    if (tokens !== original)
      await checked(
        db.rpc("worker_secret", { p_id: id, p_ciphertext: encrypt(tokens) }),
      );
    // Finish provider requests before the 15-minute queue/connection lease expires.
    const snapshot = await withProviderBudget(12 * 60_000, async () =>
      c.provider === "github"
        ? importGithub(connection, tokens.access_token)
        : importJira(connection, tokens.access_token),
    );
    await checked(
      db.rpc("publish_snapshot", {
        p_id: id,
        p_lease: lease,
        p_scope_version: c.scope_version,
        p_rows: toJson(snapshot.rows),
        p_events: toJson(snapshot.events),
        p_resources: toJson(snapshot.resources),
      }),
    );
    if (c.provider === "jira") {
      try {
        const webhook = await ensureJiraWebhook(
          connection,
          tokens.access_token,
        );
        await checked(
          db
            .from("connections")
            .update({
              ...(webhook.config ? { config: webhook.config } : {}),
              last_error: webhook.warning || null,
            })
            .eq("id", id)
            .eq("scope_version", c.scope_version),
        );
      } catch {
        await db
          .from("connections")
          .update({
            last_error:
              "Jira webhook registration or renewal failed. Scheduled reconciliation remains available.",
          })
          .eq("id", id)
          .eq("scope_version", c.scope_version);
      }
    }
    await checked(
      db
        .from("sync_runs")
        .update({
          status: "complete",
          finished_at: new Date().toISOString(),
          records_count: snapshot.rows.length,
        })
        .eq("id", runId),
    );
    await checked(db.rpc("worker_ack", { p_msg_id: message.msg_id }));
    log("sync.complete", { connectionId: id, records: snapshot.rows.length });
  } catch (error) {
    const { exhausted, seconds } = retryDecision(
      message.read_ct,
      error instanceof ProviderError ? error.status : undefined,
      error instanceof ProviderError ? error.retryAfter : 0,
    );
    const safeMessage =
      error instanceof ProviderError
        ? error.message
        : error instanceof Error &&
            /exceeds|exceeded|pagination|cursor|changed during/.test(
              error.message,
            )
          ? error.message
          : "Import failed. Check credentials, permissions, schema, and provider availability.";
    // An obsolete job must not hide a newer successful snapshot or changed scope.
    await checked(
      db
        .from("connections")
        .update({ status: "error", last_error: safeMessage })
        .eq("id", id)
        .eq("scope_version", c.scope_version)
        .or(`last_sync_at.is.null,last_sync_at.lte."${startedAt}"`),
    );
    if (runId)
      await checked(
        db
          .from("sync_runs")
          .update({
            status: exhausted ? "failed" : "retrying",
            error: safeMessage,
            finished_at: new Date().toISOString(),
          })
          .eq("id", runId),
      );
    if (exhausted)
      await checked(
        db.rpc("worker_ack", { p_msg_id: message.msg_id, p_archive: true }),
      );
    else
      await checked(
        db.rpc("worker_delay", {
          p_msg_id: message.msg_id,
          p_seconds: seconds,
        }),
      );
    log("sync.failed", {
      connectionId: id,
      retry: !exhausted,
      status: error instanceof ProviderError ? error.status : "internal",
    });
  } finally {
    await db.rpc("worker_lock", { p_id: id, p_lease: lease, p_release: true });
  }
}
async function main() {
  log("worker.started");
  while (!stopping) {
    try {
      const { data } = await checked(db.rpc("worker_read"));
      const messages = z
        .array(
          z.object({
            msg_id: z.number().int().positive(),
            read_ct: z.number().int().nonnegative(),
            message: z.object({ connection_id: z.uuid() }),
          }),
        )
        .parse(data);
      if (!messages.length)
        await new Promise((resolve) => setTimeout(resolve, 3000));
      else for (const message of messages) await job(message);
    } catch {
      log("worker.connection_error");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
  log("worker.stopped");
}
void main();
