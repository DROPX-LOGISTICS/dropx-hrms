import {
  evaluatePayrollFormula,
  normalizePayrollCode,
  payrollFormulaReferences,
  validatePayrollConfiguration
} from "./payroll-formula";

export type EmployeeSalaryHeadType =
  | "ctc"
  | "employee_earning"
  | "employee_deduction"
  | "statutory_deduction"
  | "statutory_contribution";

export type EmployeeSalaryHead = {
  payrollHeadId: string;
  payrollHeadName: string;
  payrollHeadCode: string;
  headType: EmployeeSalaryHeadType;
  calculationType: "input" | "fixed" | "formula";
  formula: string | null;
  fixedAmount: number | null;
  minimumValue: number | null;
  maximumValue: number | null;
};

export type SalaryLimitAdjustment = {
  payrollHeadId: string;
  payrollHeadName: string;
  calculatedAmount: number;
  adjustedAmount: number;
  limit: "minimum" | "maximum";
};

export type SalaryReconciliation = {
  ctc: number;
  componentTotal: number;
  difference: number;
  isBalanced: boolean;
  message: string | null;
};

const MONEY_TOLERANCE = 0.01;

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function reconcileEmployeeSalary(
  heads: EmployeeSalaryHead[],
  values: Record<string, number>
): SalaryReconciliation {
  const ctcHead = heads.find((head) => head.headType === "ctc" || normalizePayrollCode(head.payrollHeadCode) === "CTC");
  if (!ctcHead) throw new Error("The salary configuration does not contain CTC.");
  const ctc = roundMoney(Number(values[ctcHead.payrollHeadId]));
  if (!Number.isFinite(ctc)) throw new Error("Enter a valid Monthly CTC.");
  const componentTotal = roundMoney(heads
    .filter((head) => head.payrollHeadId !== ctcHead.payrollHeadId)
    .reduce((total, head) => total + Number(values[head.payrollHeadId] ?? 0), 0));
  const difference = roundMoney(componentTotal - ctc);
  const isBalanced = Math.abs(difference) <= MONEY_TOLERANCE;
  const direction = difference > 0 ? "above" : "below";
  return {
    ctc,
    componentTotal,
    difference,
    isBalanced,
    message: isBalanced
      ? null
      : `CTC components total ${componentTotal.toFixed(2)}, which is ${Math.abs(difference).toFixed(2)} ${direction} Monthly CTC ${ctc.toFixed(2)}. Adjust the component values manually.`
  };
}

export function calculateEmployeeSalary(
  heads: EmployeeSalaryHead[],
  inputValues: Record<string, number>
) {
  const normalizedHeads = heads.map((head) => ({
    ...head,
    payrollHeadCode: normalizePayrollCode(head.payrollHeadCode)
  }));
  validatePayrollConfiguration(normalizedHeads.map((head) => ({
    code: head.payrollHeadCode,
    calculationType: head.calculationType,
    formula: head.formula,
    fixedAmount: head.fixedAmount
  })));
  const byCode = new Map(normalizedHeads.map((head) => [head.payrollHeadCode, head]));
  const valuesByCode: Record<string, number> = {};
  const valuesById: Record<string, number> = {};
  const adjustments: SalaryLimitAdjustment[] = [];

  const calculate = (code: string): number => {
    if (Object.hasOwn(valuesByCode, code)) return valuesByCode[code];
    const head = byCode.get(code);
    if (!head) throw new Error(`Unknown payroll head ${code}.`);
    let calculatedAmount: number;
    if (head.calculationType === "input") {
      calculatedAmount = Number(inputValues[head.payrollHeadId]);
      if (!Number.isFinite(calculatedAmount)) throw new Error(`${head.payrollHeadName} requires a monthly value.`);
    } else if (head.calculationType === "fixed") {
      calculatedAmount = Number(head.fixedAmount);
    } else {
      for (const dependency of payrollFormulaReferences(head.formula ?? "")) calculate(dependency);
      calculatedAmount = evaluatePayrollFormula(head.formula ?? "", valuesByCode);
    }
    if (!Number.isFinite(calculatedAmount) || calculatedAmount < 0) {
      throw new Error(`${head.payrollHeadName} produced an invalid amount.`);
    }
    calculatedAmount = roundMoney(calculatedAmount);
    let adjustedAmount = calculatedAmount;
    let limit: SalaryLimitAdjustment["limit"] | null = null;
    if (head.minimumValue !== null && adjustedAmount < head.minimumValue) {
      adjustedAmount = roundMoney(head.minimumValue);
      limit = "minimum";
    }
    if (head.maximumValue !== null && adjustedAmount > head.maximumValue) {
      adjustedAmount = roundMoney(head.maximumValue);
      limit = "maximum";
    }
    if (limit) adjustments.push({
      payrollHeadId: head.payrollHeadId,
      payrollHeadName: head.payrollHeadName,
      calculatedAmount,
      adjustedAmount,
      limit
    });
    valuesByCode[code] = adjustedAmount;
    valuesById[head.payrollHeadId] = adjustedAmount;
    return adjustedAmount;
  };

  for (const head of normalizedHeads) calculate(head.payrollHeadCode);
  return {
    values: valuesById,
    adjustments,
    reconciliation: reconcileEmployeeSalary(normalizedHeads, valuesById)
  };
}
