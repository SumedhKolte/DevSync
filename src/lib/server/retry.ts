/** Retry-After accepts seconds or an HTTP date. Never send NaN to the queue. */
export function retryDelay(headers: Headers, now = Date.now()): number {
  const value = headers.get("retry-after")?.trim();
  let delay = NaN;
  if (value) {
    delay = /^\d+(\.\d+)?$/.test(value)
      ? Number(value)
      : (Date.parse(value) - now) / 1000;
  }
  if (!Number.isFinite(delay)) {
    const reset = Number(headers.get("x-ratelimit-reset"));
    delay = Number.isFinite(reset) && reset > 0 ? reset - now / 1000 : 60;
  }
  return Math.max(1, Math.min(86400, Math.ceil(delay)));
}

export function retryDecision(
  attempt: number,
  status?: number,
  providerDelay = 0,
  jitter = Math.random(),
) {
  const permanent =
    status !== undefined && [400, 401, 404, 422].includes(status);
  const exhausted = attempt >= 5 || permanent;
  const delay = Number.isFinite(providerDelay)
    ? Math.max(0, providerDelay)
    : 60;
  return {
    exhausted,
    seconds: Math.min(
      86400,
      Math.max(
        delay,
        Math.min(
          3600,
          15 * 2 ** Math.min(attempt, 8) +
            Math.floor(Math.max(0, Math.min(1, jitter)) * 15),
        ),
      ),
    ),
  };
}
