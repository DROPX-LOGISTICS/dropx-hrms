import { describe, expect, it } from "vitest";
import { calculateEmployeeSalary, EmployeeSalaryHead, reconcileEmployeeSalary } from "./employee-salary-calculator";

const heads: EmployeeSalaryHead[] = [
  {
    payrollHeadId: "11111111-1111-4111-8111-111111111111",
    payrollHeadName: "Cost to the company",
    payrollHeadCode: "CTC",
    headType: "ctc",
    calculationType: "input",
    formula: null,
    fixedAmount: null,
    minimumValue: null,
    maximumValue: null
  },
  {
    payrollHeadId: "22222222-2222-4222-8222-222222222222",
    payrollHeadName: "Basic Salary",
    payrollHeadCode: "BASIC",
    headType: "employee_earning",
    calculationType: "formula",
    formula: "CTC * 50%",
    fixedAmount: null,
    minimumValue: 12000,
    maximumValue: null
  },
  {
    payrollHeadId: "33333333-3333-4333-8333-333333333333",
    payrollHeadName: "HRA",
    payrollHeadCode: "HRA",
    headType: "employee_earning",
    calculationType: "formula",
    formula: "CTC * 25%",
    fixedAmount: null,
    minimumValue: null,
    maximumValue: null
  },
  {
    payrollHeadId: "44444444-4444-4444-8444-444444444444",
    payrollHeadName: "Allowance",
    payrollHeadCode: "ALLOWANCE",
    headType: "employee_earning",
    calculationType: "formula",
    formula: "CTC * 25%",
    fixedAmount: null,
    minimumValue: null,
    maximumValue: null
  }
];

describe("employee salary calculator", () => {
  it("calculates every head and applies configured limits", () => {
    const result = calculateEmployeeSalary(heads, { [heads[0].payrollHeadId]: 20000 });
    expect(result.values).toEqual({
      [heads[0].payrollHeadId]: 20000,
      [heads[1].payrollHeadId]: 12000,
      [heads[2].payrollHeadId]: 5000,
      [heads[3].payrollHeadId]: 5000
    });
    expect(result.adjustments).toMatchObject([{
      payrollHeadName: "Basic Salary",
      calculatedAmount: 10000,
      adjustedAmount: 12000,
      limit: "minimum"
    }]);
    expect(result.reconciliation).toMatchObject({
      ctc: 20000,
      componentTotal: 22000,
      difference: 2000,
      isBalanced: false
    });
  });

  it("accepts a manually corrected balanced breakdown", () => {
    const result = reconcileEmployeeSalary(heads, {
      [heads[0].payrollHeadId]: 20000,
      [heads[1].payrollHeadId]: 12000,
      [heads[2].payrollHeadId]: 4000,
      [heads[3].payrollHeadId]: 4000
    });
    expect(result.isBalanced).toBe(true);
  });
});
