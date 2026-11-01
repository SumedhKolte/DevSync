import { describe, expect, it } from "vitest";
import { retryDecision, retryDelay } from "../src/lib/server/retry";
import {
  providerSignal,
  withProviderBudget,
} from "../src/lib/server/provider-budget";

describe("provider retry and job deadlines", () => {
  it.each(["garbage", "NaN", "Infinity"])(
    "safely handles malformed Retry-After %s",
    (value) => {
      expect(retryDelay(new Headers({ "retry-after": value }))).toBe(60);
    },
  );
  it("supports HTTP dates and falls back to GitHub reset when malformed", () => {
    const now = Date.parse("2026-11-01T12:00:00Z");
    expect(
      retryDelay(
        new Headers({ "retry-after": "Sun, 01 Nov 2026 12:02:00 GMT" }),
        now,
      ),
    ).toBe(120);
    expect(
      retryDelay(
        new Headers({
          "retry-after": "invalid",
          "x-ratelimit-reset": String(now / 1000 + 120),
        }),
        now,
      ),
    ).toBe(120);
  });
  it("clamps negative, zero and unbounded delays to safe queue values", () => {
    expect(retryDelay(new Headers({ "retry-after": "0" }))).toBe(1);
    expect(retryDelay(new Headers({ "retry-after": "99999999" }))).toBe(86400);
    expect(retryDelay(new Headers({ "x-ratelimit-reset": "1" }))).toBe(1);
  });
  it("archives permanent errors but preserves rate-limited retries", () => {
    expect(retryDecision(1, 401).exhausted).toBe(true);
    expect(retryDecision(1, 422).exhausted).toBe(true);
    expect(retryDecision(1, 429, 3600, 0)).toEqual({
      exhausted: false,
      seconds: 3600,
    });
    expect(retryDecision(5, 503).exhausted).toBe(true);
    expect(Number.isFinite(retryDecision(1, 503, NaN).seconds)).toBe(true);
  });
  it("aborts an expired import without affecting concurrent operations", async () => {
    await withProviderBudget(5, async () => {
      const signal = providerSignal();
      await new Promise((resolve) => setTimeout(resolve, 15));
      expect(signal.aborted).toBe(true);
      expect(() => providerSignal()).toThrow();
    });
    expect(providerSignal().aborted).toBe(false);
  });
});
