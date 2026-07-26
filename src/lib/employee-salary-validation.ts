import { EmployeeSalaryHead, reconcileEmployeeSalary } from "./employee-salary-calculator";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;

export function parseEmployeeSalaryValues(
  headIds: string[],
  rawValues: string[],
  heads: EmployeeSalaryHead[]
) {
  if (headIds.length !== rawValues.length) throw new Error("Salary value rows are incomplete.");
  const permitted = new Map(heads.map((head) => [head.payrollHeadId, head]));
  const values: Record<string, number> = {};

  for (let index = 0; index < headIds.length; index += 1) {
    const payrollHeadId = headIds[index]?.trim();
    const rawValue = rawValues[index]?.trim();
    if (!UUID_PATTERN.test(payrollHeadId)) throw new Error("Select a valid payroll head.");
    const head = permitted.get(payrollHeadId);
    if (!head) throw new Error("A salary value was supplied for an invalid payroll head.");
    if (Object.hasOwn(values, payrollHeadId)) throw new Error(`${head.payrollHeadName} was entered more than once.`);
    if (!AMOUNT_PATTERN.test(rawValue)) throw new Error(`${head.payrollHeadName} must be a valid amount with up to two decimal places.`);
    const amount = Number(rawValue);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`${head.payrollHeadName} cannot be negative.`);
    if (head.minimumValue !== null && amount < head.minimumValue) {
      throw new Error(`${head.payrollHeadName} cannot be lower than ${head.minimumValue}.`);
    }
    if (head.maximumValue !== null && amount > head.maximumValue) {
      throw new Error(`${head.payrollHeadName} cannot be higher than ${head.maximumValue}.`);
    }
    values[payrollHeadId] = amount;
  }

  for (const head of heads) {
    if (!Object.hasOwn(values, head.payrollHeadId)) throw new Error(`${head.payrollHeadName} requires an employee value.`);
  }
  const reconciliation = reconcileEmployeeSalary(heads, values);
  if (!reconciliation.isBalanced) throw new Error(reconciliation.message ?? "Salary components do not match CTC.");
  return values;
}
