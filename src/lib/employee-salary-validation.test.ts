import { describe, expect, it } from "vitest";
import { parseEmployeeSalaryValues } from "./employee-salary-validation";
import { EmployeeSalaryHead } from "./employee-salary-calculator";

const ctc: EmployeeSalaryHead = {
  payrollHeadId: "11111111-1111-4111-8111-111111111111",
  payrollHeadName: "Cost to the company",
  payrollHeadCode: "CTC",
  headType: "ctc",
  calculationType: "input",
  formula: null,
  fixedAmount: null,
  minimumValue: 120000,
  maximumValue: 2400000
};

const basic: EmployeeSalaryHead = {
  payrollHeadId: "22222222-2222-4222-8222-222222222222",
  payrollHeadName: "Basic Salary",
  payrollHeadCode: "BASIC",
  headType: "employee_earning",
  calculationType: "formula",
  formula: "CTC",
  fixedAmount: null,
  minimumValue: null,
  maximumValue: null
};

describe("employee salary values", () => {
  it("parses valid employee-specific amounts", () => {
    expect(parseEmployeeSalaryValues(
      [ctc.payrollHeadId, basic.payrollHeadId],
      ["600000.50", "600000.50"],
      [ctc, basic]
    )).toEqual({
      [ctc.payrollHeadId]: 600000.5,
      [basic.payrollHeadId]: 600000.5
    });
  });

  it("requires every custom payroll input", () => {
    expect(() => parseEmployeeSalaryValues([], [], [ctc, basic])).toThrow("requires an employee value");
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

  it("rejects a breakdown that does not reconcile to CTC", () => {
    expect(() => parseEmployeeSalaryValues(
      [ctc.payrollHeadId, basic.payrollHeadId],
      ["600000", "610000"],
      [ctc, basic]
    )).toThrow("above Monthly CTC");
  });
});
