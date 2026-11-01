import { describe, expect, it } from "vitest";
import {
  clearPendingTokens,
  getPendingTokens,
  setPendingTokens,
} from "../src/lib/server/pending-tokens";
function fakeJar() {
  const store = new Map<string, string>();
  return {
    store,
    jar: {
      get: (name: string) =>
        store.has(name) ? { name, value: store.get(name)! } : undefined,
      set: (name: string, value: string) => void store.set(name, value),
      delete: (name: string) => void store.delete(name),
    } as unknown as Parameters<typeof getPendingTokens>[0],
  };
}
describe("pending provider tokens", () => {
  it("splits large encrypted tokens into cookies under the browser limit", () => {
    const { store, jar } = fakeJar();
    const value = "v1." + "a".repeat(8500);
    setPendingTokens(jar, "jira", value, { secure: false });
    expect(store.size).toBe(3);
    for (const chunk of store.values())
      expect(chunk.length).toBeLessThanOrEqual(3000);
    expect(getPendingTokens(jar, "jira")).toBe(value);
    expect(getPendingTokens(jar, "github")).toBeUndefined();
  });
  it("drops leftover chunks from a longer earlier authorization", () => {
    const { store, jar } = fakeJar();
    setPendingTokens(jar, "jira", "x".repeat(8000), { secure: false });
    setPendingTokens(jar, "jira", "short", { secure: false });
    expect(getPendingTokens(jar, "jira")).toBe("short");
    clearPendingTokens(jar, "jira");
    expect(store.size).toBe(0);
  });
});
