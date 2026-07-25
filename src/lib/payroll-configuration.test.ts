import { describe, expect, it } from "vitest";
import {
  buildPayrollValueExpression,
  parsePayrollValueExpression,
  payrollValueMethodState,
  validatePayrollValueRange
} from "./payroll-configuration";

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

  it("turns common percentage equations into a friendly method", () => {
    expect(payrollValueMethodState("CTC*50%")).toMatchObject({
      method: "percentage",
      percentageBaseCode: "CTC",
      percentage: "50"
    });
    expect(buildPayrollValueExpression({
      method: "percentage",
      fixedValue: "",
      percentageBaseCode: "CTC",
      percentage: "20",
      advancedFormula: ""
    })).toBe("CTC * 20%");
  });

  it("keeps complex equations available as an advanced method", () => {
    expect(payrollValueMethodState("(CTC - HRA) / 2")).toMatchObject({
      method: "advanced",
      advancedFormula: "(CTC - HRA) / 2"
    });
  });
});
