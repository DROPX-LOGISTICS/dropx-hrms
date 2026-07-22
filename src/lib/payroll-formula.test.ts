import { describe, expect, it } from "vitest";
import { calculatePayrollConfiguration, evaluatePayrollFormula, normalizePayrollCode, payrollFormulaReferences, validatePayrollConfiguration } from "./payroll-formula";

describe("payroll formulas", () => {
  it("normalizes custom pay head codes", () => {
    expect(normalizePayrollCode(" house rent allowance ")).toBe("HOUSE_RENT_ALLOWANCE");
  });

  it("evaluates arithmetic, references, percentages and parentheses", () => {
    expect(evaluatePayrollFormula("(CTC * 50%) + 250", { CTC: 120000 })).toBe(60250);
  });

  it("accepts bracketed pay head references", () => {
    expect(payrollFormulaReferences("[BASIC_SALARY] * 40% + CTC * 1%" )).toEqual(["BASIC_SALARY", "CTC"]);
  });

  it("rejects unsupported expressions and divide by zero", () => {
    expect(() => evaluatePayrollFormula("globalThis.alert(1)", {})).toThrow("unsupported character");
    expect(() => evaluatePayrollFormula("CTC / 0", { CTC: 1 })).toThrow("divide by zero");
  });

  it("requires CTC to remain an input", () => {
    expect(() => validatePayrollConfiguration([{ code: "CTC", calculationType: "formula", formula: "1" }])).toThrow("CTC must remain");
  });

  it("rejects unknown and circular references", () => {
    expect(() => validatePayrollConfiguration([
      { code: "CTC", calculationType: "input" },
      { code: "BASIC_SALARY", calculationType: "formula", formula: "UNKNOWN * 1%" }
    ])).toThrow("unknown pay head UNKNOWN");
    expect(() => validatePayrollConfiguration([
      { code: "CTC", calculationType: "input" },
      { code: "A", calculationType: "formula", formula: "B" },
      { code: "B", calculationType: "formula", formula: "A" }
    ])).toThrow("Circular pay head equation");
  });

  it("calculates dependent salary heads in dependency order", () => {
    const result = calculatePayrollConfiguration([
      { code: "CTC", calculationType: "input" },
      { code: "BASIC_SALARY", calculationType: "formula", formula: "CTC * 50%" },
      { code: "HRA", calculationType: "formula", formula: "BASIC_SALARY * 40%" },
      { code: "PHONE", calculationType: "fixed", fixedAmount: 1200 }
    ], { CTC: 600000 });
    expect(result).toEqual({ CTC: 600000, BASIC_SALARY: 300000, HRA: 120000, PHONE: 1200 });
  });
});
