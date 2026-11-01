import { describe, expect, it, vi } from "vitest";
import { readBody, readJson } from "../src/lib/server/http";
import { sourceUrlSchema } from "../src/lib/validation";

const request = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://devsync.example/api", { method: "POST", headers, body });
describe("request and source-link boundaries", () => {
  it("rejects malformed JSON and non-JSON media with client errors", async () => {
    await expect(
      readJson(request("{", { "content-type": "application/json" })),
    ).rejects.toMatchObject({ status: 400 });
    await expect(readJson(request("{}"))).rejects.toMatchObject({
      status: 415,
    });
    await expect(
      readJson(
        request('{"ok":true}', {
          "content-type": "application/json; charset=utf-8",
        }),
      ),
    ).resolves.toEqual({ ok: true });
  });
  it("counts UTF-8 bytes, not JavaScript characters", async () => {
    await expect(readBody(request("🙂🙂"), 7)).rejects.toMatchObject({
      status: 413,
    });
    await expect(readBody(request("🙂🙂"), 8)).resolves.toBe("🙂🙂");
  });
  it("stops oversized chunked streams even without a content-length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(8));
      },
      cancel,
    });
    const input = new Request("https://devsync.example", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBody(input, 10)).rejects.toMatchObject({ status: 413 });
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("preserves split multibyte characters for webhook signature verification", async () => {
    const bytes = new TextEncoder().encode('{"text":"🙂"}');
    const stream = new ReadableStream({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
        controller.close();
      },
    });
    const input = new Request("https://devsync.example", {
      method: "POST",
      body: stream,
      duplex: "half",
    } as RequestInit);
    await expect(readBody(input)).resolves.toBe('{"text":"🙂"}');
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,hello",
    "http://github.com/a/b",
    "https://user:password@github.com/a/b",
  ])("rejects unsafe source link %s", (url) => {
    expect(sourceUrlSchema.safeParse(url).success).toBe(false);
  });
  it("accepts HTTPS GitHub and Jira source links", () => {
    expect(
      sourceUrlSchema.safeParse("https://github.com/acme/repo/pull/1").success,
    ).toBe(true);
    expect(
      sourceUrlSchema.safeParse("https://acme.atlassian.net/browse/ENG-1")
        .success,
    ).toBe(true);
  });
});
