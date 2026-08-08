import { describe, expect, it } from "vitest";
import { createPayslipPdf, toBankExportCsv } from "./payslip";
import type { PayeeBankDetails, PayrollRunLineRow, PayrollRunRow } from "./payroll-run";

const run: PayrollRunRow = {
  id: "run-1",
  company_id: "company-1",
  period_month: "2026-07-01",
  status: "locked",
  gross_total: 50000,
  deduction_total: 5000,
  employer_cost_total: 3000,
  net_total: 45000,
  payee_count: 1,
  created_by: null,
  calculated_at: null,
  locked_at: null,
  paid_at: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z"
};

const line: PayrollRunLineRow = {
  id: "line-1",
  run_id: "run-1",
  payee_type: "employee",
  payee_id: "employee-1",
  payee_name: "Asha Nair",
  payee_code: "EMP-1",
  pay_type: "monthly",
  location_id: null,
  working_days: 26,
  present_days: 25,
  paid_leave_days: 1,
  lop_days: 0,
  lop_manual_override: false,
  gross_earnings: 50000,
  total_deductions: 5000,
  employer_contributions: 3000,
  net_pay: 45000,
  status: "calculated",
  notes: null,
  hr_payroll_run_line_items: [
    { id: "1", run_line_id: "line-1", payroll_head_id: "h1", package_id: null, component_code: "BASIC", component_name: "Basic Salary", component_type: "earning", amount: 25000, display_order: 1 },
    { id: "2", run_line_id: "line-1", payroll_head_id: "h2", package_id: null, component_code: "HRA", component_name: "House Rent Allowance", component_type: "earning", amount: 25000, display_order: 2 },
    { id: "3", run_line_id: "line-1", payroll_head_id: "h3", package_id: null, component_code: "EPF_D", component_name: "Employee PF", component_type: "deduction", amount: 5000, display_order: 3 },
    { id: "4", run_line_id: "line-1", payroll_head_id: "h4", package_id: null, component_code: "EPF_C", component_name: "Employer PF", component_type: "employer_contribution", amount: 3000, display_order: 4 }
  ]
};

const payee: PayeeBankDetails = {
  fullName: "Asha Nair",
  code: "EMP-1",
  designation: "Executive",
  bankAccountNo: "1234567890",
  ifsc: "HDFC0000123"
};

describe("createPayslipPdf", () => {
  it("generates a PDF without throwing on the Indian Rupee amounts", async () => {
    const bytes = await createPayslipPdf({ companyName: "DropX Logistics", run, line, payee });
    expect(bytes.byteLength).toBeGreaterThan(0);
    // %PDF- magic header confirms a valid PDF document was produced.
    expect(Buffer.from(bytes.slice(0, 5)).toString("utf8")).toBe("%PDF-");
  });
});

describe("toBankExportCsv", () => {
  it("formats rows as escaped CSV", () => {
    const csv = toBankExportCsv([
      { payeeType: "employee", payeeName: "Asha Nair", payeeCode: "EMP-1", bankAccountNo: "1234567890", ifsc: "HDFC0000123", netPay: 45000 }
    ]);
    expect(csv).toContain("Payee Type,Name,Code,Bank Account No,IFSC,Net Pay");
    expect(csv).toContain("\"employee\",\"Asha Nair\",\"EMP-1\",\"1234567890\",\"HDFC0000123\",45000.00");
  });
});
