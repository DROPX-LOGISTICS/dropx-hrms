import { describe, expect, it } from "vitest";
import { activeNavLabel } from "./nav-active";

describe("activeNavLabel", () => {
  it("maps top-level routes", () => {
    expect(activeNavLabel("/")).toBe("Overview");
    expect(activeNavLabel("/people")).toBe("People");
    expect(activeNavLabel("/people/123")).toBe("People");
    expect(activeNavLabel("/attendance")).toBe("Attendance");
    expect(activeNavLabel("/settings")).toBe("Settings");
    expect(activeNavLabel("/settings/payroll-heads")).toBe("Payroll Heads");
  });
});
