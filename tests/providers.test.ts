import { afterEach, describe, expect, it, vi } from "vitest";
import {
  githubPages,
  providerFetch,
  ProviderError,
} from "../src/lib/server/providers";
import { summarizeChecks } from "../src/lib/checks";
import { adfText } from "../src/lib/server/importers";
afterEach(() => vi.unstubAllGlobals());
describe("provider contract boundaries", () => {
  it("follows pagination even when a page contains fewer than 100 rows", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json(
          { repositories: [{ id: 1 }] },
          {
            headers: {
              link: '<https://api.github.com/test?page=2>; rel="next"',
            },
          },
        ),
      )
      .mockResolvedValueOnce(Response.json({ repositories: [{ id: 2 }] }));
    vi.stubGlobal("fetch", fetch);
    expect(await githubPages("/test", "token", "repositories")).toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(fetch.mock.calls[1][0]).toContain("page=2");
  });
  it("stops paging when the caller no longer needs later pages", async () => {
    const next = { link: '<https://api.github.com/test?page=2>; rel="next"' };
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json([{ old: true }], { headers: next }));
    vi.stubGlobal("fetch", fetch);
    expect(
      await githubPages<{ old: boolean }>(
        "/test",
        "token",
        undefined,
        (batch) => batch[batch.length - 1].old,
      ),
    ).toEqual([{ old: true }]);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("preserves rate-limit delays without exposing provider error bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("sensitive provider response", {
          status: 429,
          headers: { "retry-after": "120" },
        }),
      ),
    );
    try {
      await providerFetch("https://api.github.com/test", "token");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).retryAfter).toBe(120);
      expect((error as Error).message).not.toContain("sensitive");
    }
  });
  it("does not silently turn access denial into an empty successful import", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );
    await expect(githubPages("/test", "token")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("retains unknown for absent or skipped-only checks", () => {
    expect(summarizeChecks([], { state: "pending", statuses: [] })).toBe(
      "unknown",
    );
    expect(
      summarizeChecks([{ status: "completed", conclusion: "skipped" }], {
        state: "pending",
        statuses: [],
      }),
    ).toBe("unknown");
  });
  it("failure takes precedence over pending and success", () => {
    expect(
      summarizeChecks(
        [
          { status: "completed", conclusion: "failure" },
          { status: "queued", conclusion: null },
        ],
        { state: "success", statuses: [{}] },
      ),
    ).toBe("failing");
  });
  it("extracts plain text from nested Atlassian documents", () => {
    expect(
      adfText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Hello " },
              { type: "text", text: "team" },
            ],
          },
          { type: "paragraph", content: [{ type: "text", text: "Next step" }] },
        ],
      }),
    ).toBe("Hello team\n\nNext step");
  });
});
