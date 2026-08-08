import type { PayrollHeadType } from "@/lib/payroll";

export const payrollHeadPayTypeOptions: { value: PayrollHeadType; label: string }[] = [
  { value: "employee_earning", label: "Employee Earning" },
  { value: "employee_deduction", label: "Employee Deduction" },
  { value: "statutory_deduction", label: "Statutory Deduction" },
  { value: "statutory_contribution", label: "Statutory Contribution" }
];

export const payrollHeadTypeLabel: Record<PayrollHeadType, string> = {
  ctc: "System CTC",
  employee_earning: "Employee Earning",
  employee_deduction: "Employee Deduction",
  statutory_deduction: "Statutory Deduction",
  statutory_contribution: "Statutory Contribution"
};
