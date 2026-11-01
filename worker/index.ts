import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { decrypt, encrypt } from "../src/lib/server/crypto";
import { importGithub, importJira } from "../src/lib/server/importers";
import {
  ProviderError,
  refreshTokens,
  type ConnectionRow,
  type ProviderTokens,
} from "../src/lib/server/providers";
import { ensureJiraWebhook } from "../src/lib/server/jira-webhooks";
const db = createClient(
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
  const { data: c } = await checked(
    db.from("connections").select("*").eq("id", id).maybeSingle(),
  );
  if (!c) {
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
  try {
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
    const tokens = await refreshTokens(c.provider, original);
    if (tokens !== original)
      await checked(
        db.rpc("worker_secret", { p_id: id, p_ciphertext: encrypt(tokens) }),
      );
    const snapshot =
      c.provider === "github"
        ? await importGithub(c as ConnectionRow, tokens.access_token)
        : await importJira(c as ConnectionRow, tokens.access_token);
    await checked(
      db.rpc("publish_snapshot", {
        p_id: id,
        p_lease: lease,
        p_scope_version: c.scope_version,
        p_rows: snapshot.rows,
        p_events: snapshot.events,
        p_resources: snapshot.resources,
      }),
    );
    if (c.provider === "jira") {
      try {
        const webhook = await ensureJiraWebhook(
          c as ConnectionRow,
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
          .eq("id", id);
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
    const permanent =
      error instanceof ProviderError && [400, 401, 404].includes(error.status);
    const exhausted = message.read_ct >= 5 || permanent;
    const safeMessage =
      error instanceof ProviderError
        ? error.message
        : error instanceof Error &&
            /exceeds|exceeded|pagination|cursor|changed during/.test(
              error.message,
            )
          ? error.message
          : "Import failed. Check credentials, permissions, schema, and provider availability.";
    await db
      .from("connections")
      .update({ status: "error", last_error: safeMessage })
      .eq("id", id);
    if (runId)
      await db
        .from("sync_runs")
        .update({
          status: exhausted ? "failed" : "retrying",
          error: safeMessage,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    if (exhausted)
      await db.rpc("worker_ack", { p_msg_id: message.msg_id, p_archive: true });
    else
      await db.rpc("worker_delay", {
        p_msg_id: message.msg_id,
        p_seconds: Math.max(
          error instanceof ProviderError ? error.retryAfter : 0,
          Math.min(
            3600,
            15 * 2 ** message.read_ct + Math.floor(Math.random() * 15),
          ),
        ),
      });
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
      const messages = data as {
        msg_id: number;
        read_ct: number;
        message: { connection_id: string };
      }[];
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
