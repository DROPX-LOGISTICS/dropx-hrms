import { describe, expect, it } from "vitest";
import { isCurrentFormAction } from "./submit-button";

describe("isCurrentFormAction", () => {
  it("matches only the decision button that submitted a multi-action form", () => {
    const data = new FormData();
    data.set("decision", "approved");

    expect(isCurrentFormAction(data, "decision", "approved")).toBe(true);
    expect(isCurrentFormAction(data, "decision", "rejected")).toBe(false);
    expect(isCurrentFormAction(data)).toBe(true);
  });
});
