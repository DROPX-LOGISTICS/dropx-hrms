import { describe, expect, it } from "vitest";
import { matchNames } from "./name-match";

describe("profile name matching", () => {
  it("normalizes punctuation, casing, and extra spaces for an exact match", () => {
    expect(matchNames("  Ravi-Kumar P. ", "RAVI KUMAR P")).toEqual({ status: "exact", percent: 100 });
  });

  it("marks reordered name tokens for manual review", () => {
    expect(matchNames("Ravi Kumar P", "P Kumar Ravi")).toEqual({ status: "partial", percent: 100 });
  });

  it("requires manual review for a partial but plausible match", () => {
    expect(matchNames("Ravi Kumar", "Ravi K")).toEqual({ status: "partial", percent: 75 });
  });

  it("blocks clearly different names", () => {
    expect(matchNames("Ravi Kumar", "Asha Nair")).toEqual({ status: "none", percent: 0 });
  });
});
