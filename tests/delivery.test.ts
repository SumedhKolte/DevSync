import { describe, expect, it } from "vitest";
import { getDemoData } from "../src/lib/demo";
import {
  attachPullRequests,
  connectionHealth,
  deliveryBrief,
  deliverySummary,
} from "../src/lib/delivery";

describe("delivery brief and source trust", () => {
  it("counts linked open PRs once even when several work items share them", () => {
    const data = getDemoData();
    const original = deliverySummary(data);
    data.items.push({ ...data.items[0], id: "duplicate" });
    expect(deliverySummary(data).linked).toBe(original.linked);
    expect(original.coverage).toBeLessThanOrEqual(100);
  });
  it("does not suggest unknown or failing checks as approved and passing", () => {
    const data = getDemoData();
    data.pullRequests.forEach((pr) => {
      pr.review = "approved";
      pr.checks = "unknown";
    });
    expect(deliverySummary(data).ready).toHaveLength(0);
  });
  it("treats the exact RLS expiry boundary and malformed dates as stale", () => {
    const data = getDemoData();
    const c = data.connections[0];
    c.lastSync = new Date(Date.parse(data.asOf) - 30 * 60_000).toISOString();
    expect(connectionHealth(c, data.asOf)).toBe("stale");
    c.lastSync = "invalid";
    expect(connectionHealth(c, data.asOf)).toBe("stale");
    c.resources = [];
    expect(connectionHealth(c, data.asOf)).toBe("unconfigured");
  });
  it("only joins visible PR endpoints and deduplicates repeated edges", () => {
    const data = getDemoData();
    const edge = {
      work_item_id: data.items[0].id,
      pull_request_id: data.pullRequests[0].id,
    };
    const result = attachPullRequests(data.items, data.pullRequests, [
      edge,
      edge,
      { ...edge, pull_request_id: "hidden" },
    ]);
    expect(result[0].pullRequests).toEqual([data.pullRequests[0]]);
    expect(result[1].pullRequests).toEqual([]);
  });
  it("exports an honest snapshot and escapes source-provided Markdown", () => {
    const data = getDemoData();
    data.workspaceName = "[click](javascript:alert(1))\n# injected";
    const brief = deliveryBrief(data);
    expect(brief).toContain("SAMPLE DATA");
    expect(brief).toContain(data.asOf);
    expect(brief).toContain("mergeability not verified");
    expect(brief).not.toContain("\n# injected");
    expect(brief).not.toContain("[click]");
  });
  it("reports empty coverage as unavailable rather than 100%", () => {
    const data = getDemoData();
    data.pullRequests = [];
    expect(deliverySummary(data).coverage).toBeNull();
  });
});
