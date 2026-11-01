import { describe, expect, it, vi, afterEach } from "vitest";
import { getDemoData } from "../src/lib/demo";
import { getEvidence } from "../src/lib/evidence";
afterEach(() => vi.useRealTimers());
describe("delivery evidence", () => {
  it("traces signals to linked records and flags unmatched PRs", () => {
    const data = getDemoData();
    const signals = getEvidence(data);
    expect(signals).toHaveLength(4);
    expect(signals.find((s) => s.rule === "failed-checks")?.item?.key).toBe(
      "ENG-138",
    );
    expect(signals.find((s) => s.rule === "unlinked")?.pr?.number).toBe(252);
  });
  it("does not infer success from unknown checks", () => {
    const data = getDemoData();
    data.pullRequests[1].checks = "unknown";
    expect(getEvidence(data).some((s) => s.rule === "failed-checks")).toBe(
      false,
    );
  });
  it("excludes stale observations", () => {
    const data = getDemoData();
    expect(getEvidence(data, Date.now() + 8 * 86400000)).toHaveLength(0);
  });
  it("does not flag completed work simply because its PR merged", () => {
    const data = getDemoData();
    const signals = getEvidence(data);
    expect(signals.some((s) => s.item?.key === "ENG-125")).toBe(false);
  });
  it("does not mutate Jira status or source records", () => {
    const data = getDemoData();
    const before = JSON.stringify(data);
    getEvidence(data);
    expect(JSON.stringify(data)).toBe(before);
  });
});
