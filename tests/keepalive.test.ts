import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSelfPing } from "../src/lib/server/keepalive";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("worker self-ping", () => {
  it("requests its own health URL on every interval and stops on demand", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}"));
    const log = vi.fn();
    const stop = startSelfPing("https://devsync-worker.onrender.com/", log, {
      intervalMs: 1000,
      request,
    });
    expect(log).toHaveBeenCalledWith("worker.selfping_started", {
      everyMinutes: 1000 / 60_000,
    });
    await vi.advanceTimersByTimeAsync(3000);
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.calls[0][0]).toBe(
      "https://devsync-worker.onrender.com/healthz",
    );
    stop();
    await vi.advanceTimersByTimeAsync(3000);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("logs failures without throwing", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockRejectedValueOnce(new TypeError("offline"));
    const log = vi.fn();
    startSelfPing("https://worker.test", log, { intervalMs: 1000, request });
    await vi.advanceTimersByTimeAsync(2000);
    expect(log).toHaveBeenCalledWith("worker.selfping_failed", { status: 503 });
    expect(log).toHaveBeenCalledWith("worker.selfping_failed", {
      status: "unreachable",
    });
  });
  it("does nothing without a public HTTPS address", async () => {
    const request = vi.fn();
    const log = vi.fn();
    for (const origin of [undefined, "", "http://127.0.0.1:3000"])
      startSelfPing(origin, log, { intervalMs: 1000, request })();
    await vi.advanceTimersByTimeAsync(5000);
    expect(request).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
