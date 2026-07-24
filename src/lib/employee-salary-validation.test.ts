import { describe, expect, it } from "vitest";
import { parseEmployeeSalaryValues } from "./employee-salary-validation";

const ctc = {
  payrollHeadId: "11111111-1111-4111-8111-111111111111",
  payrollHeadName: "Cost to the company",
  minimumValue: 120000,
  maximumValue: 2400000
};

describe("employee salary values", () => {
  it("parses valid employee-specific amounts", () => {
    expect(parseEmployeeSalaryValues([ctc.payrollHeadId], ["600000.50"], [ctc])).toEqual({
      [ctc.payrollHeadId]: 600000.5
    });
  });

  it("requires every custom payroll input", () => {
    expect(() => parseEmployeeSalaryValues([], [], [ctc])).toThrow("requires an employee value");
  });

  it("rejects invalid, duplicate, and out-of-range values", () => {
    expect(() => parseEmployeeSalaryValues([ctc.payrollHeadId], ["600000.555"], [ctc])).toThrow("two decimal");
    expect(() => parseEmployeeSalaryValues([ctc.payrollHeadId], ["100000"], [ctc])).toThrow("lower than");
    expect(() => parseEmployeeSalaryValues(
      [ctc.payrollHeadId, ctc.payrollHeadId],
      ["600000", "700000"],
      [ctc]
    )).toThrow("more than once");
  });
});
