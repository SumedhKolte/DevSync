// Render's free plan sleeps a web service after 15 minutes without inbound
// HTTP traffic. A request to the service's own public URL goes through
// Render's proxy, so it counts as traffic and keeps the instance awake.
export const SELF_PING_INTERVAL_MS = 9 * 60_000;

type Log = (event: string, fields?: Record<string, unknown>) => void;

/** Ping `${origin}/healthz` on an interval; returns a function that stops it. */
export function startSelfPing(
  origin: string | undefined,
  log: Log,
  {
    intervalMs = SELF_PING_INTERVAL_MS,
    request = fetch,
  }: { intervalMs?: number; request?: typeof fetch } = {},
) {
  // Only a public HTTPS address passes through the host's proxy. Without one
  // (local development) there is nothing to keep awake.
  if (!origin?.startsWith("https://")) return () => undefined;
  const url = `${origin.replace(/\/$/, "")}/healthz`;
  const ping = async () => {
    try {
      const response = await request(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok)
        log("worker.selfping_failed", { status: response.status });
    } catch {
      log("worker.selfping_failed", { status: "unreachable" });
    }
  };
  const timer = setInterval(() => void ping(), intervalMs);
  // The poll loop keeps the process alive; this timer must never do so.
  timer.unref();
  log("worker.selfping_started", { everyMinutes: intervalMs / 60_000 });
  return () => clearInterval(timer);
}
