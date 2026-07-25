import { payrollFormulaReferences } from "./payroll-formula";

export type PayrollValueDefinition =
  | { calculationType: "input"; valueExpression: null; formula: null; fixedAmount: null }
  | { calculationType: "fixed"; valueExpression: string; formula: null; fixedAmount: number }
  | { calculationType: "formula"; valueExpression: string; formula: string; fixedAmount: null };

const CONSTANT_PATTERN = /^(?:\d+(?:\.\d*)?|\.\d+)$/;
const PERCENTAGE_PATTERN = /^\s*(?:\[([A-Za-z][A-Za-z0-9_]*)\]|([A-Za-z][A-Za-z0-9_]*))\s*\*\s*((?:\d+(?:\.\d*)?|\.\d+))\s*%\s*$/;

export type PayrollValueMethod = "input" | "fixed" | "percentage" | "advanced";

export type PayrollValueMethodState = {
  method: PayrollValueMethod;
  fixedValue: string;
  percentageBaseCode: string;
  percentage: string;
  advancedFormula: string;
};

export function payrollValueMethodState(rawValue: string): PayrollValueMethodState {
  const value = rawValue.trim();
  if (!value) return { method: "input", fixedValue: "", percentageBaseCode: "", percentage: "", advancedFormula: "" };
  if (CONSTANT_PATTERN.test(value)) {
    return { method: "fixed", fixedValue: value, percentageBaseCode: "", percentage: "", advancedFormula: "" };
  }
  const percentage = value.match(PERCENTAGE_PATTERN);
  if (percentage) {
    return {
      method: "percentage",
      fixedValue: "",
      percentageBaseCode: (percentage[1] ?? percentage[2]).toUpperCase(),
      percentage: percentage[3],
      advancedFormula: ""
    };
  }
  return { method: "advanced", fixedValue: "", percentageBaseCode: "", percentage: "", advancedFormula: value };
}

export function buildPayrollValueExpression(state: PayrollValueMethodState) {
  if (state.method === "input") return "";
  if (state.method === "fixed") return state.fixedValue.trim();
  if (state.method === "advanced") return state.advancedFormula.trim();
  const code = state.percentageBaseCode.trim().toUpperCase();
  const percentage = state.percentage.trim();
  return code && percentage ? `${code} * ${percentage}%` : "";
}

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
