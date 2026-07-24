export type EmployeeSalaryInput = {
  payrollHeadId: string;
  payrollHeadName: string;
  minimumValue: number | null;
  maximumValue: number | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AMOUNT_PATTERN = /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/;

export function parseEmployeeSalaryValues(
  headIds: string[],
  rawValues: string[],
  inputs: EmployeeSalaryInput[]
) {
  if (headIds.length !== rawValues.length) throw new Error("Salary value rows are incomplete.");
  const permitted = new Map(inputs.map((input) => [input.payrollHeadId, input]));
  const values: Record<string, number> = {};

  for (let index = 0; index < headIds.length; index += 1) {
    const payrollHeadId = headIds[index]?.trim();
    const rawValue = rawValues[index]?.trim();
    if (!UUID_PATTERN.test(payrollHeadId)) throw new Error("Select a valid payroll head.");
    const input = permitted.get(payrollHeadId);
    if (!input) throw new Error("A salary value was supplied for an invalid payroll head.");
    if (Object.hasOwn(values, payrollHeadId)) throw new Error(`${input.payrollHeadName} was entered more than once.`);
    if (!AMOUNT_PATTERN.test(rawValue)) throw new Error(`${input.payrollHeadName} must be a valid amount with up to two decimal places.`);
    const amount = Number(rawValue);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`${input.payrollHeadName} cannot be negative.`);
    if (input.minimumValue !== null && amount < input.minimumValue) {
      throw new Error(`${input.payrollHeadName} cannot be lower than ${input.minimumValue}.`);
    }
    if (input.maximumValue !== null && amount > input.maximumValue) {
      throw new Error(`${input.payrollHeadName} cannot be higher than ${input.maximumValue}.`);
    }
    values[payrollHeadId] = amount;
  }

  for (const input of inputs) {
    if (!Object.hasOwn(values, input.payrollHeadId)) throw new Error(`${input.payrollHeadName} requires an employee value.`);
  }
  return values;
}
