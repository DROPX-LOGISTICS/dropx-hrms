import { describe, expect, it } from "vitest";
import { employeeInitials } from "./employee-avatar";

describe("employeeInitials", () => {
  it("uses the first and last names", () => {
    expect(employeeInitials("NISAR AHAMMED NOTTATH")).toBe("NN");
  });

  it("uses two letters for a single name", () => {
    expect(employeeInitials("Varun")).toBe("VA");
  });

  it("normalizes whitespace and empty names", () => {
    expect(employeeInitials("  Muhammed   Jamsheer ")).toBe("MJ");
    expect(employeeInitials("   ")).toBe("?");
  });
});
