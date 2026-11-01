import { afterEach, expect, it, vi } from "vitest";
import {
  githubMetadata,
  jiraSprintMetadata,
  jiraStatusHistory,
} from "../src/lib/server/source-importers";
import type { ConnectionRow } from "../src/lib/server/providers";
const fixture: ConnectionRow = {
  id: "connection",
  workspace_id: "workspace",
  owner_id: "owner",
  provider: "jira",
  provider_account_id: "site",
  scope_version: 0,
  config: { cloud_id: "site", installation_id: 1 },
  resources: [{ id: "123", name: "Engineering" }],
};
afterEach(() => vi.unstubAllGlobals());
it("preserves an empty repository without inventing commits", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ repositories: [{ id: 123, full_name: "acme/empty" }] }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 123,
          full_name: "acme/empty",
          description: null,
          default_branch: "main",
          private: true,
          html_url: "https://github.com/acme/empty",
        }),
      )
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(new Response(null, { status: 409 })),
  );
  const result = await githubMetadata(
    { ...fixture, provider: "github" },
    "token",
  );
  expect(result).toHaveLength(1);
  expect(result[0].payload).toMatchObject({
    name: "acme/empty",
    commits: [],
    branches: [],
  });
});
it("gracefully handles unavailable Jira Software boards", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          values: [{ id: "123", name: "Engineering", key: "ENG" }],
          isLast: true,
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 })),
  );
  expect(await jiraSprintMetadata(fixture, "token")).toEqual([]);
});
it("does not suppress expired authorization when loading sprints", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  );
  await expect(jiraSprintMetadata(fixture, "token")).rejects.toMatchObject({
    status: 401,
  });
});
it("loads the latest bounded Jira history and retains status provenance", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ total: 40, values: [] }))
    .mockResolvedValueOnce(
      Response.json({
        values: [
          {
            id: "h1",
            created: "2026-11-01T00:00:00Z",
            author: { displayName: "Alex" },
            items: [
              { field: "status", fromString: "To do", toString: "In progress" },
              { field: "summary", fromString: "Old", toString: "New" },
            ],
          },
        ],
      }),
    );
  vi.stubGlobal("fetch", fetch);
  const events = await jiraStatusHistory(fixture, "token", [
    {
      id: "1",
      key: "ENG-1",
      title: "Example",
      url: "https://example.atlassian.net/browse/ENG-1",
    },
  ]);
  expect(fetch.mock.calls[1][0]).toContain("startAt=20");
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({
    actor: "Alex",
    target: "ENG-1 · Example",
    text: "changed status from To do to In progress",
  });
});
