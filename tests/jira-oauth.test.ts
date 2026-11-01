import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizationUrl, jiraScopes, jiraSites } from "../src/lib/oauth";
import { ensureJiraWebhook } from "../src/lib/server/jira-webhooks";
import type { ConnectionRow } from "../src/lib/server/providers";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Jira OAuth", () => {
  it("requests granular scopes only", () => {
    const scope = authorizationUrl("jira", "client", "https://app", "s")
      .searchParams.get("scope")!
      .split(" ");
    expect(scope).toEqual(jiraScopes);
    expect(scope).not.toContain("read:jira-work");
    expect(scope).not.toContain("manage:jira-webhook");
    expect(scope).toContain("read:issue-details:jira");
    expect(scope).toContain("offline_access");
  });
  it("keeps sites granted granular or classic issue access", () => {
    const sites = jiraSites([
      {
        id: "a",
        name: "Granular",
        url: "https://a.atlassian.net",
        scopes: ["read:issue-details:jira"],
      },
      {
        id: "b",
        name: "Classic",
        url: "https://b.atlassian.net",
        scopes: ["read:jira-work"],
      },
      {
        id: "c",
        name: "Confluence only",
        url: "https://c.atlassian.net",
        scopes: ["read:confluence-content.all"],
      },
    ]);
    expect(sites.map((s) => s.id)).toEqual(["a", "b"]);
  });
  it("renews existing webhooks through the refresh endpoint", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://devsync.example");
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ expirationDate: 1_900_000_000_000 }));
    vi.stubGlobal("fetch", fetch);
    const connection = {
      id: "c1",
      config: {
        cloud_id: "cloud",
        webhook_ids: [7],
        webhook_scope: "10000",
        webhook_expires_at: Date.now() + 86400000,
      },
      resources: [{ id: "10000", name: "Project" }],
    } as ConnectionRow;
    const result = await ensureJiraWebhook(connection, "token");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).toBe(
      "https://api.atlassian.com/ex/jira/cloud/rest/api/3/webhook/refresh",
    );
    expect(fetch.mock.calls[0][1].method).toBe("PUT");
    expect(result.config?.webhook_expires_at).toBe(1_900_000_000_000);
  });
});
