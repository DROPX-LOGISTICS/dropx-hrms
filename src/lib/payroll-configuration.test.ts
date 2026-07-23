import { describe, expect, it } from "vitest";
import { parsePayrollValueExpression, validatePayrollValueRange } from "./payroll-configuration";

describe("salary configuration values", () => {
  it("treats a blank value as custom employee input", () => {
    expect(parsePayrollValueExpression("  ")).toEqual({
      calculationType: "input",
      valueExpression: null,
      formula: null,
      fixedAmount: null
    });
  });

  it("distinguishes constants from equations", () => {
    expect(parsePayrollValueExpression("1500")).toMatchObject({ calculationType: "fixed", fixedAmount: 1500 });
    expect(parsePayrollValueExpression("CTC * 50%")).toMatchObject({ calculationType: "formula", formula: "CTC * 50%" });
  });

  it("validates minimum and maximum values", () => {
    const constant = parsePayrollValueExpression("1500");
    expect(validatePayrollValueRange("1000", "2000", constant)).toEqual({ minimumValue: 1000, maximumValue: 2000 });
    expect(() => validatePayrollValueRange("2000", "1000", constant)).toThrow("Maximum value");
    expect(() => validatePayrollValueRange("1600", "", constant)).toThrow("lower than minimum");
  });
});
