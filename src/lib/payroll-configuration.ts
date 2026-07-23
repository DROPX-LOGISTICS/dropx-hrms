import { payrollFormulaReferences } from "./payroll-formula";

export type PayrollValueDefinition =
  | { calculationType: "input"; valueExpression: null; formula: null; fixedAmount: null }
  | { calculationType: "fixed"; valueExpression: string; formula: null; fixedAmount: number }
  | { calculationType: "formula"; valueExpression: string; formula: string; fixedAmount: null };

const CONSTANT_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

export function parsePayrollValueExpression(rawValue: string): PayrollValueDefinition {
  const valueExpression = rawValue.trim();
  if (!valueExpression) return { calculationType: "input", valueExpression: null, formula: null, fixedAmount: null };
  if (CONSTANT_PATTERN.test(valueExpression)) {
    const fixedAmount = Number(valueExpression);
    if (!Number.isFinite(fixedAmount) || fixedAmount < 0) throw new Error("Constant payroll values must be zero or greater.");
    return { calculationType: "fixed", valueExpression, formula: null, fixedAmount };
  }
  payrollFormulaReferences(valueExpression);
  return { calculationType: "formula", valueExpression, formula: valueExpression, fixedAmount: null };
}

function optionalLimit(rawValue: string, label: string) {
  const value = rawValue.trim();
  if (!value) return null;
  if (!CONSTANT_PATTERN.test(value)) throw new Error(`${label} must be a valid number.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be zero or greater.`);
  return parsed;
}

export function validatePayrollValueRange(rawMinimum: string, rawMaximum: string, definition: PayrollValueDefinition) {
  const minimumValue = optionalLimit(rawMinimum, "Minimum value");
  const maximumValue = optionalLimit(rawMaximum, "Maximum value");
  if (minimumValue !== null && maximumValue !== null && maximumValue < minimumValue) {
    throw new Error("Maximum value cannot be lower than minimum value.");
  }
  if (definition.calculationType === "fixed") {
    if (minimumValue !== null && definition.fixedAmount < minimumValue) throw new Error("Constant value cannot be lower than minimum value.");
    if (maximumValue !== null && definition.fixedAmount > maximumValue) throw new Error("Constant value cannot be higher than maximum value.");
  }
  return { minimumValue, maximumValue };
}
