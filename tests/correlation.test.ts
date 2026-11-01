import { describe, expect, it } from "vitest";
import { extractIssueKeys, classifyLinks } from "../src/lib/correlation";
describe("explicit Jira references", () => {
  it("extracts and deduplicates keys across branch, title and body", () => {
    expect(
      extractIssueKeys(
        "feature/ENG-142-permissions",
        "ENG-142: roles",
        "Fixes API-12 and ENG-142",
      ),
    ).toEqual(["ENG-142", "API-12"]);
  });
  it("rejects accidental substrings and does not guess from similar titles", () => {
    expect(
      extractIssueKeys(
        "eng-142",
        "myENG-142thing",
        "permissions for workspace",
      ),
    ).toEqual([]);
  });
  it("supports multiple valid issue references without arbitrarily selecting one", () => {
    expect(
      classifyLinks(["ENG-1", "ENG-2"], new Set(["ENG-1", "ENG-2"])),
    ).toEqual({
      confirmed: ["ENG-1", "ENG-2"],
      unresolved: [],
      state: "linked",
    });
  });
  it("keeps unresolved evidence visible", () => {
    expect(classifyLinks(["ENG-1", "XYZ-9"], new Set(["ENG-1"]))).toEqual({
      confirmed: ["ENG-1"],
      unresolved: ["XYZ-9"],
      state: "ambiguous",
    });
  });
});
