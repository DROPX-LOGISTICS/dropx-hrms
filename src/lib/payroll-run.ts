import "server-only";
import { HrmsAuthContext } from "@/lib/auth";
import { DEFAULT_PAGE_SIZE, listLocations, loadCompanySettings } from "@/lib/data";
import { isPackageType, PACKAGE_TYPE_LABELS, PACKAGE_TYPES, type PackageType } from "@/lib/package-types";
import { normalizePayrollCode } from "@/lib/payroll-formula";
import { computeEsi, computePf, computeProfessionalTax, loadStatutorySettings, roundMoney, type StatutorySettings } from "@/lib/statutory";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PayrollRunStatus = "draft" | "calculated" | "locked" | "paid" | "cancelled";
export type PayeeType = "employee" | "contractor";
export type PayType = "monthly" | "package";
export type PayrollLineStatus = "pending" | "calculated" | "excluded" | "error";
export type ComponentType = "earning" | "deduction" | "employer_contribution";
export type { PackageType };
export { PACKAGE_TYPES, PACKAGE_TYPE_LABELS, isPackageType };

export type PayrollRunRow = {
  id: string;
  company_id: string;
  period_month: string;
  status: PayrollRunStatus;
  gross_total: number;
  deduction_total: number;
  employer_cost_total: number;
  net_total: number;
  payee_count: number;
  created_by: string | null;
  calculated_at: string | null;
  locked_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PayrollRunLineItemRow = {
  id: string;
  run_line_id: string;
  payroll_head_id: string | null;
  package_id: string | null;
  component_code: string;
  component_name: string;
  component_type: ComponentType;
  amount: number;
  display_order: number;
};

export type PayrollRunLineRow = {
  id: string;
  run_id: string;
  payee_type: PayeeType;
  payee_id: string;
  payee_name: string;
  payee_code: string | null;
  pay_type: PayType;
  location_id: string | null;
  working_days: number;
  present_days: number;
  paid_leave_days: number;
  lop_days: number;
  lop_manual_override: boolean;
  gross_earnings: number;
  total_deductions: number;
  employer_contributions: number;
  net_pay: number;
  status: PayrollLineStatus;
  notes: string | null;
  hr_payroll_run_line_items?: PayrollRunLineItemRow[];
};

export type PackageRateDefaultRow = {
  id: string;
  company_id: string;
  package_type: PackageType;
  rate: number;
};

export type PackageRateOverrideRow = {
  id: string;
  company_id: string;
  payee_type: PayeeType;
  payee_id: string;
  package_type: PackageType;
  rate: number;
};

export type PayrollPackageEntryRow = {
  id: string;
  company_id: string;
  run_id: string;
  run_line_id: string;
  payee_type: PayeeType;
  payee_id: string;
  package_type: PackageType;
  quantity: number;
  rate: number;
  amount: number;
};

export type RunStationRow = {
  stationId: string;
  stationCode: string;
  stationName: string;
  memberCount: number;
  grossTotal: number;
  deductionTotal: number;
  netTotal: number;
};

export const UNASSIGNED_STATION_ID = "unassigned";

const WEEKDAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const PF_EMPLOYEE_CODES = new Set(["EPF_D", "PF_D", "PF"]);
const PF_EMPLOYER_CODES = new Set(["EPF_C", "PF_C"]);
const ESI_EMPLOYEE_CODES = new Set(["ESI_D", "ESI"]);
const ESI_EMPLOYER_CODES = new Set(["ESI_C"]);
const PT_CODES = new Set(["PROFESSION_TAX", "PT"]);

function db() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}

function normalizedPeriod(periodMonth: string) {
  if (!/^\d{4}-\d{2}/.test(periodMonth)) throw new Error("Enter a valid pay period.");
  return `${periodMonth.slice(0, 7)}-01`;
}

function monthBounds(periodMonth: string) {
  const [year, month] = periodMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { start, end };
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function countWorkingDays(start: Date, end: Date, workWeek: string[]) {
  const allowed = new Set(workWeek.length ? workWeek : ["mon", "tue", "wed", "thu", "fri", "sat"]);
  let count = 0;
  for (let day = new Date(start); day <= end; day.setUTCDate(day.getUTCDate() + 1)) {
    if (allowed.has(WEEKDAY_CODES[day.getUTCDay()])) count += 1;
  }
  return count;
}

function overlapDays(rangeStart: Date, rangeEnd: Date, start: string, end: string) {
  const requestStart = new Date(`${start}T00:00:00Z`);
  const requestEnd = new Date(`${end}T00:00:00Z`);
  const overlapStart = requestStart > rangeStart ? requestStart : rangeStart;
  const overlapEnd = requestEnd < rangeEnd ? requestEnd : rangeEnd;
  if (overlapEnd < overlapStart) return 0;
  return Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86_400_000) + 1;
}

function roundHalfDay(value: number) {
  return Math.round(value * 2) / 2;
}

function isApplicable(applicability: string[] | null | undefined, code: "pf" | "esi") {
  return Array.isArray(applicability) && applicability.includes(code);
}

function permittedLocationIds(auth: HrmsAuthContext) {
  return auth.locationIds.length ? auth.locationIds : ["__none__"];
}

function normalizePage(value?: number | string) {
  const page = Number(value ?? 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

function resolveStationFilter(stationId: string): string | null {
  if (stationId === UNASSIGNED_STATION_ID) return null;
  return stationId;
}

export async function listPayrollRuns(auth: HrmsAuthContext) {
  const { data, error } = await db()
    .from("hr_payroll_runs")
    .select("*")
    .eq("company_id", auth.companyId)
    .neq("status", "cancelled")
    .order("period_month", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PayrollRunRow[];
}

export async function getPayrollRun(auth: HrmsAuthContext, runId: string) {
  const runResult = await db().from("hr_payroll_runs").select("*").eq("company_id", auth.companyId).eq("id", runId).maybeSingle();
  if (runResult.error) throw new Error(runResult.error.message);
  if (!runResult.data) return null;

  const linesResult = await db()
    .from("hr_payroll_run_lines")
    .select("*, hr_payroll_run_line_items(*)")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId)
    .order("payee_name");
  if (linesResult.error) throw new Error(linesResult.error.message);

  const lines = (linesResult.data ?? []).map((line) => ({
    ...line,
    hr_payroll_run_line_items: ((line.hr_payroll_run_line_items ?? []) as PayrollRunLineItemRow[]).sort((a, b) => a.display_order - b.display_order)
  })) as PayrollRunLineRow[];

  return { run: runResult.data as PayrollRunRow, lines };
}

export function suggestNextPeriod(existingPeriods: string[]) {
  const now = new Date();
  let candidate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const taken = new Set(existingPeriods);
  for (let guard = 0; guard < 24; guard += 1) {
    const value = isoDate(candidate);
    if (!taken.has(value)) return value;
    candidate = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 1));
  }
  return isoDate(candidate);
}

export async function createPayrollRun(auth: HrmsAuthContext, periodMonthInput: string) {
  const periodMonth = normalizedPeriod(periodMonthInput);
  const existing = await db()
    .from("hr_payroll_runs")
    .select("id")
    .eq("company_id", auth.companyId)
    .eq("period_month", periodMonth)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) throw new Error("A payroll run already exists for this period.");

  const runResult = await db()
    .from("hr_payroll_runs")
    .insert({ company_id: auth.companyId, period_month: periodMonth, status: "draft", created_by: auth.userId })
    .select("id")
    .single();
  if (runResult.error || !runResult.data) throw new Error(runResult.error?.message ?? "Unable to create payroll run.");
  const runId = runResult.data.id as string;

  try {
    const [employeesResult, contractorsResult] = await Promise.all([
      db().from("employees").select("id, employee_code, full_name, hr_pay_type, location_id").eq("company_id", auth.companyId).eq("is_active", true),
      db().from("contractors").select("id, dropx_id, full_name, location_id").eq("company_id", auth.companyId).eq("is_active", true)
    ]);
    if (employeesResult.error) throw new Error(employeesResult.error.message);
    if (contractorsResult.error) throw new Error(contractorsResult.error.message);

    const lineRows = [
      ...(employeesResult.data ?? []).map((employee) => ({
        company_id: auth.companyId,
        run_id: runId,
        payee_type: "employee",
        payee_id: employee.id,
        payee_name: employee.full_name,
        payee_code: employee.employee_code,
        pay_type: employee.hr_pay_type === "package" ? "package" : "monthly",
        location_id: employee.location_id ?? null,
        status: "pending"
      })),
      ...(contractorsResult.data ?? []).map((contractor) => ({
        company_id: auth.companyId,
        run_id: runId,
        payee_type: "contractor",
        payee_id: contractor.id,
        payee_name: contractor.full_name,
        payee_code: contractor.dropx_id,
        pay_type: "package",
        location_id: contractor.location_id ?? null,
        status: "pending"
      }))
    ];

    if (lineRows.length) {
      const insertResult = await db().from("hr_payroll_run_lines").insert(lineRows);
      if (insertResult.error) throw new Error(insertResult.error.message);
    }
    const countResult = await db().from("hr_payroll_runs").update({ payee_count: lineRows.length }).eq("id", runId);
    if (countResult.error) throw new Error(countResult.error.message);
  } catch (error) {
    await db().from("hr_payroll_runs").delete().eq("id", runId);
    throw error;
  }

  return runId;
}

async function fetchRunOrThrow(auth: HrmsAuthContext, runId: string) {
  const { data, error } = await db().from("hr_payroll_runs").select("*").eq("company_id", auth.companyId).eq("id", runId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Payroll run was not found.");
  return data as PayrollRunRow;
}

type MonthlyContext = {
  companyId: string;
  periodStart: Date;
  periodEnd: Date;
  workingDays: number;
  fullDayMinutes: number;
  halfDayMinutes: number;
  statutory: StatutorySettings;
};

async function calculateMonthlyLine(context: MonthlyContext, line: { id: string; payee_id: string }, lopOverrideDays?: number) {
  const { companyId, periodStart, periodEnd, workingDays, fullDayMinutes, halfDayMinutes, statutory } = context;
  const periodStartIso = isoDate(periodStart);
  const periodEndIso = isoDate(periodEnd);

  const [employeeResult, assignmentResult, attendanceResult, leaveResult] = await Promise.all([
    db().from("employees").select("statutory_applicability").eq("company_id", companyId).eq("id", line.payee_id).maybeSingle(),
    db()
      .from("hr_employee_salary_assignments")
      .select("id, effective_from, effective_to, configuration_id, hr_employee_salary_values(payroll_head_id, amount), hr_salary_configurations(hr_salary_configuration_items(payroll_head_id, is_enabled, hr_payroll_heads(id, code, name, head_type)))")
      .eq("company_id", companyId)
      .eq("employee_id", line.payee_id)
      .lte("effective_from", periodEndIso)
      .or(`effective_to.is.null,effective_to.gte.${periodStartIso}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db()
      .from("attendance_daily")
      .select("punch_date, work_minutes")
      .eq("company_id", companyId)
      .eq("employee_id", line.payee_id)
      .eq("worker_type", "employee")
      .gte("punch_date", periodStartIso)
      .lte("punch_date", periodEndIso),
    db()
      .from("hr_leave_requests")
      .select("start_date, end_date")
      .eq("company_id", companyId)
      .eq("employee_id", line.payee_id)
      .eq("status", "approved")
      .lte("start_date", periodEndIso)
      .gte("end_date", periodStartIso)
  ]);

  if (assignmentResult.error) throw new Error(assignmentResult.error.message);
  if (!assignmentResult.data) {
    return {
      status: "error" as const,
      notes: "No active salary structure is assigned for this period.",
      workingDays,
      presentDays: 0,
      paidLeaveDays: 0,
      lopDays: workingDays,
      grossEarnings: 0,
      totalDeductions: 0,
      employerContributions: 0,
      netPay: 0,
      items: [] as Array<{ payrollHeadId: string | null; code: string; name: string; type: ComponentType; amount: number }>
    };
  }

  const applicability = employeeResult.data?.statutory_applicability ?? null;
  const attendanceRows = attendanceResult.error ? [] : (attendanceResult.data ?? []);
  const leaveRows = leaveResult.error ? [] : (leaveResult.data ?? []);

  let presentDays = 0;
  for (const row of attendanceRows) {
    const minutes = Number(row.work_minutes ?? 0);
    if (minutes >= fullDayMinutes) presentDays += 1;
    else if (minutes >= halfDayMinutes) presentDays += 0.5;
  }

  let paidLeaveDays = 0;
  for (const request of leaveRows) {
    paidLeaveDays += overlapDays(periodStart, periodEnd, request.start_date, request.end_date);
  }

  const presentEquivalent = Math.min(presentDays + paidLeaveDays, workingDays);
  const naturalLopDays = roundHalfDay(Math.max(workingDays - presentEquivalent, 0));
  const lopDays = lopOverrideDays !== undefined ? roundHalfDay(Math.max(0, lopOverrideDays)) : naturalLopDays;
  const attendanceFactor = workingDays > 0 ? Math.max(0, Math.min((workingDays - lopDays) / workingDays, 1)) : 1;

  const configItems = (assignmentResult.data.hr_salary_configurations as unknown as { hr_salary_configuration_items?: Array<{ payroll_head_id: string; is_enabled: boolean; hr_payroll_heads: { id: string; code: string; name: string; head_type: string } | null }> } | null)?.hr_salary_configuration_items ?? [];
  const valuesByHead = new Map<string, number>(
    ((assignmentResult.data.hr_employee_salary_values as Array<{ payroll_head_id: string; amount: number }>) ?? []).map((value) => [value.payroll_head_id, Number(value.amount)])
  );

  const items: Array<{ payrollHeadId: string | null; code: string; name: string; type: ComponentType; amount: number }> = [];
  let grossEarnings = 0;
  let basicAmount = 0;

  for (const item of configItems) {
    const head = item.hr_payroll_heads;
    if (!item.is_enabled || !head || head.head_type !== "employee_earning") continue;
    const stored = valuesByHead.get(head.id) ?? 0;
    const amount = roundMoney(stored * attendanceFactor);
    grossEarnings = roundMoney(grossEarnings + amount);
    if (normalizePayrollCode(head.code) === "BASIC_SALARY") basicAmount = amount;
    items.push({ payrollHeadId: head.id, code: head.code, name: head.name, type: "earning", amount });
  }
  if (!basicAmount) basicAmount = grossEarnings;

  let totalDeductions = 0;
  let employerContributions = 0;
  let ptApplied = false;

  for (const item of configItems) {
    const head = item.hr_payroll_heads;
    if (!item.is_enabled || !head) continue;
    if (head.head_type === "employee_deduction") {
      const amount = roundMoney(valuesByHead.get(head.id) ?? 0);
      totalDeductions = roundMoney(totalDeductions + amount);
      items.push({ payrollHeadId: head.id, code: head.code, name: head.name, type: "deduction", amount });
      continue;
    }
    if (head.head_type === "statutory_deduction") {
      const code = normalizePayrollCode(head.code);
      let amount: number;
      if (PF_EMPLOYEE_CODES.has(code)) amount = isApplicable(applicability, "pf") ? computePf(basicAmount, statutory).employee : 0;
      else if (ESI_EMPLOYEE_CODES.has(code)) amount = isApplicable(applicability, "esi") ? computeEsi(grossEarnings, statutory).employee : 0;
      else if (PT_CODES.has(code)) { amount = computeProfessionalTax(grossEarnings, statutory); ptApplied = true; }
      else amount = roundMoney((valuesByHead.get(head.id) ?? 0) * attendanceFactor);
      totalDeductions = roundMoney(totalDeductions + amount);
      items.push({ payrollHeadId: head.id, code: head.code, name: head.name, type: "deduction", amount });
      continue;
    }
    if (head.head_type === "statutory_contribution") {
      const code = normalizePayrollCode(head.code);
      let amount: number;
      if (PF_EMPLOYER_CODES.has(code)) amount = isApplicable(applicability, "pf") ? computePf(basicAmount, statutory).employer : 0;
      else if (ESI_EMPLOYER_CODES.has(code)) amount = isApplicable(applicability, "esi") ? computeEsi(grossEarnings, statutory).employer : 0;
      else amount = roundMoney((valuesByHead.get(head.id) ?? 0) * attendanceFactor);
      employerContributions = roundMoney(employerContributions + amount);
      items.push({ payrollHeadId: head.id, code: head.code, name: head.name, type: "employer_contribution", amount });
    }
  }

  if (!ptApplied && statutory.ptEnabled) {
    const amount = computeProfessionalTax(grossEarnings, statutory);
    if (amount > 0) {
      totalDeductions = roundMoney(totalDeductions + amount);
      items.push({ payrollHeadId: null, code: "PT", name: "Professional Tax", type: "deduction", amount });
    }
  }

  const netPay = roundMoney(grossEarnings - totalDeductions);

  return {
    status: "calculated" as const,
    notes: null,
    workingDays,
    presentDays: roundHalfDay(presentDays),
    paidLeaveDays: roundHalfDay(paidLeaveDays),
    lopDays,
    grossEarnings,
    totalDeductions,
    employerContributions,
    netPay,
    items
  };
}

type PackageContext = {
  companyId: string;
  runId: string;
  periodStart: Date;
  periodEnd: Date;
  statutory: StatutorySettings;
};

async function calculatePackageLine(context: PackageContext, line: { id: string; payee_type: PayeeType; payee_id: string }) {
  const { companyId, runId, periodStart, periodEnd, statutory } = context;
  const periodStartIso = isoDate(periodStart);
  const periodEndIso = isoDate(periodEnd);

  const table = line.payee_type === "employee" ? "employees" : "contractors";
  const [payeeResult, releaseResult, structuredResult] = await Promise.all([
    db().from(table).select("statutory_applicability").eq("company_id", companyId).eq("id", line.payee_id).maybeSingle(),
    db().from("hr_pay_packages").update({ payroll_run_id: null, status: "approved" }).eq("payroll_run_id", runId).eq("payee_type", line.payee_type).eq("payee_id", line.payee_id),
    db()
      .from("hr_payroll_package_entries")
      .select("package_type, quantity, rate, amount")
      .eq("company_id", companyId)
      .eq("run_line_id", line.id)
      .gt("amount", 0)
      .order("package_type")
  ]);
  if (releaseResult.error) throw new Error(releaseResult.error.message);
  if (structuredResult.error) throw new Error(structuredResult.error.message);

  const packagesResult = await db()
    .from("hr_pay_packages")
    .select("id, title, amount, job_date")
    .eq("company_id", companyId)
    .eq("payee_type", line.payee_type)
    .eq("payee_id", line.payee_id)
    .eq("status", "approved")
    .is("payroll_run_id", null)
    .gte("job_date", periodStartIso)
    .lte("job_date", periodEndIso)
    .order("job_date");
  if (packagesResult.error) throw new Error(packagesResult.error.message);

  const structuredEntries = structuredResult.data ?? [];
  const packages = packagesResult.data ?? [];
  const items: Array<{ payrollHeadId: string | null; packageId: string | null; code: string; name: string; type: ComponentType; amount: number }> = [];
  let grossEarnings = 0;

  for (const entry of structuredEntries) {
    const amount = roundMoney(Number(entry.amount));
    if (amount <= 0) continue;
    grossEarnings = roundMoney(grossEarnings + amount);
    const packageType = entry.package_type as PackageType;
    items.push({
      payrollHeadId: null,
      packageId: null,
      code: String(entry.package_type).toUpperCase(),
      name: `${PACKAGE_TYPE_LABELS[packageType] ?? entry.package_type} × ${Number(entry.quantity)} @ ₹${Number(entry.rate)}`,
      type: "earning",
      amount
    });
  }

  for (const item of packages) {
    const amount = roundMoney(Number(item.amount));
    grossEarnings = roundMoney(grossEarnings + amount);
    items.push({ payrollHeadId: null, packageId: item.id, code: "PACKAGE", name: item.title, type: "earning", amount });
  }

  const applicability = payeeResult.data?.statutory_applicability ?? null;
  let totalDeductions = 0;
  let employerContributions = 0;

  if (grossEarnings > 0 && isApplicable(applicability, "pf")) {
    const pf = computePf(grossEarnings, statutory);
    if (pf.employee > 0) { totalDeductions = roundMoney(totalDeductions + pf.employee); items.push({ payrollHeadId: null, packageId: null, code: "EPF_D", name: "Provident Fund", type: "deduction", amount: pf.employee }); }
    if (pf.employer > 0) { employerContributions = roundMoney(employerContributions + pf.employer); items.push({ payrollHeadId: null, packageId: null, code: "EPF_C", name: "Provident Fund (Employer)", type: "employer_contribution", amount: pf.employer }); }
  }
  if (grossEarnings > 0 && isApplicable(applicability, "esi")) {
    const esi = computeEsi(grossEarnings, statutory);
    if (esi.employee > 0) { totalDeductions = roundMoney(totalDeductions + esi.employee); items.push({ payrollHeadId: null, packageId: null, code: "ESI_D", name: "ESI", type: "deduction", amount: esi.employee }); }
    if (esi.employer > 0) { employerContributions = roundMoney(employerContributions + esi.employer); items.push({ payrollHeadId: null, packageId: null, code: "ESI_C", name: "ESI (Employer)", type: "employer_contribution", amount: esi.employer }); }
  }
  const pt = computeProfessionalTax(grossEarnings, statutory);
  if (pt > 0) { totalDeductions = roundMoney(totalDeductions + pt); items.push({ payrollHeadId: null, packageId: null, code: "PT", name: "Professional Tax", type: "deduction", amount: pt }); }

  const netPay = roundMoney(grossEarnings - totalDeductions);
  const claimedIds = packages.map((item) => item.id);
  const hasEarnings = structuredEntries.length > 0 || packages.length > 0;

  return {
    status: "calculated" as const,
    notes: hasEarnings ? null : "No package counts or approved job entries were found for this period.",
    grossEarnings,
    totalDeductions,
    employerContributions,
    netPay,
    items,
    claimedIds
  };
}

export async function calculatePayrollRun(auth: HrmsAuthContext, runId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  if (run.status === "locked" || run.status === "paid") throw new Error("A locked or paid run cannot be recalculated.");

  const { start, end } = monthBounds(run.period_month);
  const [companySettings, statutory] = await Promise.all([loadCompanySettings(auth), loadStatutorySettings(auth)]);
  const workingDays = countWorkingDays(start, end, companySettings?.work_week ?? []);
  const fullDayMinutes = companySettings?.full_day_minutes ?? 480;
  const halfDayMinutes = companySettings?.half_day_minutes ?? 240;

  const linesResult = await db().from("hr_payroll_run_lines").select("id, payee_type, payee_id, pay_type, lop_manual_override, lop_days").eq("company_id", auth.companyId).eq("run_id", runId);
  if (linesResult.error) throw new Error(linesResult.error.message);
  const lines = linesResult.data ?? [];

  let grossTotal = 0;
  let deductionTotal = 0;
  let employerCostTotal = 0;
  let netTotal = 0;

  for (const line of lines) {
    const deleteItemsResult = await db().from("hr_payroll_run_line_items").delete().eq("run_line_id", line.id);
    if (deleteItemsResult.error) throw new Error(deleteItemsResult.error.message);

    if (line.pay_type === "monthly") {
      const lopOverrideDays = line.lop_manual_override ? Number(line.lop_days) : undefined;
      const result = await calculateMonthlyLine({ companyId: auth.companyId, periodStart: start, periodEnd: end, workingDays, fullDayMinutes, halfDayMinutes, statutory }, line, lopOverrideDays);

      const updateResult = await db().from("hr_payroll_run_lines").update({
        working_days: result.workingDays,
        present_days: result.presentDays,
        paid_leave_days: result.paidLeaveDays,
        lop_days: result.lopDays,
        gross_earnings: result.grossEarnings,
        total_deductions: result.totalDeductions,
        employer_contributions: result.employerContributions,
        net_pay: result.netPay,
        status: result.status,
        notes: result.notes
      }).eq("id", line.id);
      if (updateResult.error) throw new Error(updateResult.error.message);

      if (result.items.length) {
        const itemRows = result.items.map((item, index) => ({
          company_id: auth.companyId,
          run_line_id: line.id,
          payroll_head_id: item.payrollHeadId,
          package_id: null,
          component_code: item.code,
          component_name: item.name,
          component_type: item.type,
          amount: item.amount,
          display_order: index
        }));
        const insertItemsResult = await db().from("hr_payroll_run_line_items").insert(itemRows);
        if (insertItemsResult.error) throw new Error(insertItemsResult.error.message);
      }

      if (result.status === "calculated") {
        grossTotal = roundMoney(grossTotal + result.grossEarnings);
        deductionTotal = roundMoney(deductionTotal + result.totalDeductions);
        employerCostTotal = roundMoney(employerCostTotal + result.employerContributions);
        netTotal = roundMoney(netTotal + result.netPay);
      }
    } else {
      const result = await calculatePackageLine({ companyId: auth.companyId, runId, periodStart: start, periodEnd: end, statutory }, line as { id: string; payee_type: PayeeType; payee_id: string });

      const updateResult = await db().from("hr_payroll_run_lines").update({
        working_days: 0,
        present_days: 0,
        paid_leave_days: 0,
        lop_days: 0,
        gross_earnings: result.grossEarnings,
        total_deductions: result.totalDeductions,
        employer_contributions: result.employerContributions,
        net_pay: result.netPay,
        status: result.status,
        notes: result.notes
      }).eq("id", line.id);
      if (updateResult.error) throw new Error(updateResult.error.message);

      if (result.items.length) {
        const itemRows = result.items.map((item, index) => ({
          company_id: auth.companyId,
          run_line_id: line.id,
          payroll_head_id: item.payrollHeadId,
          package_id: item.packageId,
          component_code: item.code,
          component_name: item.name,
          component_type: item.type,
          amount: item.amount,
          display_order: index
        }));
        const insertItemsResult = await db().from("hr_payroll_run_line_items").insert(itemRows);
        if (insertItemsResult.error) throw new Error(insertItemsResult.error.message);
      }

      if (result.claimedIds.length) {
        const claimResult = await db().from("hr_pay_packages").update({ payroll_run_id: runId, status: "included_in_run" }).in("id", result.claimedIds);
        if (claimResult.error) throw new Error(claimResult.error.message);
      }

      grossTotal = roundMoney(grossTotal + result.grossEarnings);
      deductionTotal = roundMoney(deductionTotal + result.totalDeductions);
      employerCostTotal = roundMoney(employerCostTotal + result.employerContributions);
      netTotal = roundMoney(netTotal + result.netPay);
    }
  }

  const runUpdateResult = await db().from("hr_payroll_runs").update({
    status: "calculated",
    gross_total: grossTotal,
    deduction_total: deductionTotal,
    employer_cost_total: employerCostTotal,
    net_total: netTotal,
    calculated_at: new Date().toISOString()
  }).eq("id", runId);
  if (runUpdateResult.error) throw new Error(runUpdateResult.error.message);
}

export async function setLineLopOverride(auth: HrmsAuthContext, runLineId: string, lopDays: number) {
  const lineResult = await db().from("hr_payroll_run_lines").select("id, run_id, pay_type").eq("company_id", auth.companyId).eq("id", runLineId).maybeSingle();
  if (lineResult.error) throw new Error(lineResult.error.message);
  if (!lineResult.data) throw new Error("Payroll line was not found.");
  if (lineResult.data.pay_type !== "monthly") throw new Error("Loss of pay can only be overridden for monthly-salaried payees.");
  const run = await fetchRunOrThrow(auth, lineResult.data.run_id);
  if (run.status === "locked" || run.status === "paid") throw new Error("Locked or paid runs cannot be edited.");
  if (!Number.isFinite(lopDays) || lopDays < 0) throw new Error("Enter a valid number of loss-of-pay days.");
  const updateResult = await db().from("hr_payroll_run_lines").update({ lop_days: lopDays, lop_manual_override: true }).eq("id", runLineId);
  if (updateResult.error) throw new Error(updateResult.error.message);
  await calculatePayrollRun(auth, lineResult.data.run_id);
}

export async function addManualAdjustment(auth: HrmsAuthContext, runLineId: string, input: { name: string; amount: number; type: ComponentType }) {
  const lineResult = await db().from("hr_payroll_run_lines").select("id, run_id, gross_earnings, total_deductions, employer_contributions, net_pay").eq("company_id", auth.companyId).eq("id", runLineId).maybeSingle();
  if (lineResult.error) throw new Error(lineResult.error.message);
  if (!lineResult.data) throw new Error("Payroll line was not found.");
  const run = await fetchRunOrThrow(auth, lineResult.data.run_id);
  if (run.status === "locked" || run.status === "paid") throw new Error("Locked or paid runs cannot be edited.");
  if (!input.name.trim()) throw new Error("Enter a description for the adjustment.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter a valid adjustment amount.");

  const nextOrderResult = await db().from("hr_payroll_run_line_items").select("display_order").eq("run_line_id", runLineId).order("display_order", { ascending: false }).limit(1).maybeSingle();
  const nextOrder = (nextOrderResult.data?.display_order ?? 0) + 1;

  const insertResult = await db().from("hr_payroll_run_line_items").insert({
    company_id: auth.companyId,
    run_line_id: runLineId,
    payroll_head_id: null,
    package_id: null,
    component_code: "ADJUSTMENT",
    component_name: input.name.trim(),
    component_type: input.type,
    amount: roundMoney(input.amount),
    display_order: nextOrder
  });
  if (insertResult.error) throw new Error(insertResult.error.message);

  const amount = roundMoney(input.amount);
  const grossEarnings = input.type === "earning" ? roundMoney(Number(lineResult.data.gross_earnings) + amount) : Number(lineResult.data.gross_earnings);
  const totalDeductions = input.type === "deduction" ? roundMoney(Number(lineResult.data.total_deductions) + amount) : Number(lineResult.data.total_deductions);
  const employerContributions = input.type === "employer_contribution" ? roundMoney(Number(lineResult.data.employer_contributions) + amount) : Number(lineResult.data.employer_contributions);
  const netPay = roundMoney(grossEarnings - totalDeductions);

  const updateResult = await db().from("hr_payroll_run_lines").update({ gross_earnings: grossEarnings, total_deductions: totalDeductions, employer_contributions: employerContributions, net_pay: netPay, status: "calculated" }).eq("id", runLineId);
  if (updateResult.error) throw new Error(updateResult.error.message);

  await recomputeRunTotals(auth, lineResult.data.run_id);
}

async function recomputeRunTotals(auth: HrmsAuthContext, runId: string) {
  const linesResult = await db().from("hr_payroll_run_lines").select("gross_earnings, total_deductions, employer_contributions, net_pay, status").eq("run_id", runId);
  if (linesResult.error) throw new Error(linesResult.error.message);
  const totals = (linesResult.data ?? []).filter((line) => line.status === "calculated").reduce((accumulator, line) => ({
    gross: roundMoney(accumulator.gross + Number(line.gross_earnings)),
    deductions: roundMoney(accumulator.deductions + Number(line.total_deductions)),
    employerCost: roundMoney(accumulator.employerCost + Number(line.employer_contributions)),
    net: roundMoney(accumulator.net + Number(line.net_pay))
  }), { gross: 0, deductions: 0, employerCost: 0, net: 0 });
  const updateResult = await db().from("hr_payroll_runs").update({
    gross_total: totals.gross,
    deduction_total: totals.deductions,
    employer_cost_total: totals.employerCost,
    net_total: totals.net
  }).eq("id", runId).eq("company_id", auth.companyId);
  if (updateResult.error) throw new Error(updateResult.error.message);
}

export async function lockPayrollRun(auth: HrmsAuthContext, runId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  if (run.status !== "calculated") throw new Error("Calculate the run before locking it.");
  const updateResult = await db().from("hr_payroll_runs").update({ status: "locked", locked_at: new Date().toISOString() }).eq("id", runId);
  if (updateResult.error) throw new Error(updateResult.error.message);
}

export async function unlockPayrollRun(auth: HrmsAuthContext, runId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  if (run.status !== "locked") throw new Error("Only a locked run can be reopened.");
  const updateResult = await db().from("hr_payroll_runs").update({ status: "calculated", locked_at: null }).eq("id", runId);
  if (updateResult.error) throw new Error(updateResult.error.message);
}

export async function markPayrollRunPaid(auth: HrmsAuthContext, runId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  if (run.status !== "locked") throw new Error("Lock the run before marking it as paid.");
  const updateResult = await db().from("hr_payroll_runs").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", runId);
  if (updateResult.error) throw new Error(updateResult.error.message);
  const packageUpdateResult = await db().from("hr_pay_packages").update({ status: "paid" }).eq("payroll_run_id", runId);
  if (packageUpdateResult.error) throw new Error(packageUpdateResult.error.message);
}

export type PackagePayeeOption = { id: string; type: PayeeType; name: string; code: string | null };

export async function listPackagePayees(auth: HrmsAuthContext): Promise<PackagePayeeOption[]> {
  const [employeesResult, contractorsResult] = await Promise.all([
    db().from("employees").select("id, employee_code, full_name").eq("company_id", auth.companyId).eq("is_active", true).eq("hr_pay_type", "package").order("full_name"),
    db().from("contractors").select("id, dropx_id, full_name").eq("company_id", auth.companyId).eq("is_active", true).order("full_name")
  ]);
  if (employeesResult.error) throw new Error(employeesResult.error.message);
  if (contractorsResult.error) throw new Error(contractorsResult.error.message);
  return [
    ...(employeesResult.data ?? []).map((employee) => ({ id: employee.id, type: "employee" as const, name: employee.full_name, code: employee.employee_code })),
    ...(contractorsResult.data ?? []).map((contractor) => ({ id: contractor.id, type: "contractor" as const, name: contractor.full_name, code: contractor.dropx_id }))
  ];
}

export type PayPackageRow = {
  id: string;
  payee_type: PayeeType;
  payee_id: string;
  title: string;
  description: string | null;
  amount: number;
  job_date: string;
  status: "draft" | "approved" | "included_in_run" | "paid" | "cancelled";
  payroll_run_id: string | null;
  created_at: string;
};

export async function listPendingPayPackages(auth: HrmsAuthContext) {
  const { data, error } = await db()
    .from("hr_pay_packages")
    .select("id, payee_type, payee_id, title, description, amount, job_date, status, payroll_run_id, created_at")
    .eq("company_id", auth.companyId)
    .in("status", ["draft", "approved"])
    .order("job_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PayPackageRow[];
}

export async function listPackagesForPayee(auth: HrmsAuthContext, payeeType: PayeeType, payeeId: string, limit = 10) {
  const { data, error } = await db()
    .from("hr_pay_packages")
    .select("id, payee_type, payee_id, title, description, amount, job_date, status, payroll_run_id, created_at")
    .eq("company_id", auth.companyId)
    .eq("payee_type", payeeType)
    .eq("payee_id", payeeId)
    .order("job_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as PayPackageRow[];
}

export async function createPayPackage(auth: HrmsAuthContext, input: { payeeType: PayeeType; payeeId: string; title: string; description?: string; amount: number; jobDate: string }) {
  if (!input.title.trim() || input.title.trim().length < 2) throw new Error("Enter a title for this job or package.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Enter a valid amount.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.jobDate)) throw new Error("Enter a valid job date.");
  const table = input.payeeType === "employee" ? "employees" : "contractors";
  const payeeResult = await db().from(table).select("id").eq("company_id", auth.companyId).eq("id", input.payeeId).maybeSingle();
  if (payeeResult.error) throw new Error(payeeResult.error.message);
  if (!payeeResult.data) throw new Error("The selected payee was not found.");
  const insertResult = await db().from("hr_pay_packages").insert({
    company_id: auth.companyId,
    payee_type: input.payeeType,
    payee_id: input.payeeId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    amount: roundMoney(input.amount),
    job_date: input.jobDate,
    status: "approved",
    created_by: auth.userId
  });
  if (insertResult.error) throw new Error(insertResult.error.message);
}

export async function deletePayPackage(auth: HrmsAuthContext, packageId: string) {
  const existing = await db().from("hr_pay_packages").select("id, status").eq("company_id", auth.companyId).eq("id", packageId).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (!existing.data) throw new Error("Package entry was not found.");
  if (existing.data.status !== "draft" && existing.data.status !== "approved") throw new Error("Only pending package entries can be removed.");
  const deleteResult = await db().from("hr_pay_packages").delete().eq("id", packageId);
  if (deleteResult.error) throw new Error(deleteResult.error.message);
}

export type PayeeBankDetails = {
  fullName: string;
  code: string | null;
  designation: string | null;
  bankAccountNo: string | null;
  ifsc: string | null;
};

async function loadPayeeBankDetails(auth: HrmsAuthContext, payeeType: PayeeType, payeeId: string): Promise<PayeeBankDetails> {
  if (payeeType === "employee") {
    const { data, error } = await db()
      .from("employees")
      .select("full_name, employee_code, bank_account_no, ifsc, designations(name)")
      .eq("company_id", auth.companyId)
      .eq("id", payeeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Employee was not found.");
    const designation = data.designations as unknown as { name: string | null } | null;
    return { fullName: data.full_name, code: data.employee_code, designation: designation?.name ?? null, bankAccountNo: data.bank_account_no, ifsc: data.ifsc };
  }
  const { data, error } = await db()
    .from("contractors")
    .select("full_name, dropx_id, designation, bank_account_no, ifsc_code")
    .eq("company_id", auth.companyId)
    .eq("id", payeeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Contractor was not found.");
  return { fullName: data.full_name, code: data.dropx_id, designation: data.designation, bankAccountNo: data.bank_account_no, ifsc: data.ifsc_code };
}

export async function getPayslipData(auth: HrmsAuthContext, runId: string, lineId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  const lineResult = await db()
    .from("hr_payroll_run_lines")
    .select("*, hr_payroll_run_line_items(*)")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId)
    .eq("id", lineId)
    .maybeSingle();
  if (lineResult.error) throw new Error(lineResult.error.message);
  if (!lineResult.data) throw new Error("Payroll line was not found.");
  const line = {
    ...lineResult.data,
    hr_payroll_run_line_items: ((lineResult.data.hr_payroll_run_line_items ?? []) as PayrollRunLineItemRow[]).sort((a, b) => a.display_order - b.display_order)
  } as PayrollRunLineRow;
  const payee = await loadPayeeBankDetails(auth, line.payee_type, line.payee_id);
  return { run, line, payee };
}

export type BankExportRow = {
  payeeType: PayeeType;
  payeeName: string;
  payeeCode: string | null;
  bankAccountNo: string | null;
  ifsc: string | null;
  netPay: number;
};

export async function listBankExportRows(auth: HrmsAuthContext, runId: string): Promise<{ run: PayrollRunRow; rows: BankExportRow[] }> {
  const run = await fetchRunOrThrow(auth, runId);
  const linesResult = await db()
    .from("hr_payroll_run_lines")
    .select("payee_type, payee_id, payee_name, payee_code, net_pay, status")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId)
    .eq("status", "calculated")
    .order("payee_name");
  if (linesResult.error) throw new Error(linesResult.error.message);
  const lines = linesResult.data ?? [];

  const employeeIds = [...new Set(lines.filter((line) => line.payee_type === "employee").map((line) => line.payee_id))];
  const contractorIds = [...new Set(lines.filter((line) => line.payee_type === "contractor").map((line) => line.payee_id))];

  const [employeesResult, contractorsResult] = await Promise.all([
    employeeIds.length
      ? db().from("employees").select("id, bank_account_no, ifsc").eq("company_id", auth.companyId).in("id", employeeIds)
      : Promise.resolve({ data: [], error: null }),
    contractorIds.length
      ? db().from("contractors").select("id, bank_account_no, ifsc_code").eq("company_id", auth.companyId).in("id", contractorIds)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (employeesResult.error) throw new Error(employeesResult.error.message);
  if (contractorsResult.error) throw new Error(contractorsResult.error.message);

  const bankByEmployeeId = new Map((employeesResult.data ?? []).map((row) => [row.id, { bankAccountNo: row.bank_account_no as string | null, ifsc: row.ifsc as string | null }]));
  const bankByContractorId = new Map((contractorsResult.data ?? []).map((row) => [row.id, { bankAccountNo: row.bank_account_no as string | null, ifsc: row.ifsc_code as string | null }]));

  const rows = lines.map((line) => {
    const bank = (line.payee_type === "employee" ? bankByEmployeeId.get(line.payee_id) : bankByContractorId.get(line.payee_id)) ?? { bankAccountNo: null, ifsc: null };
    return {
      payeeType: line.payee_type as PayeeType,
      payeeName: line.payee_name,
      payeeCode: line.payee_code,
      bankAccountNo: bank.bankAccountNo,
      ifsc: bank.ifsc,
      netPay: Number(line.net_pay)
    };
  });
  return { run, rows };
}

export async function cancelPayrollRun(auth: HrmsAuthContext, runId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  if (run.status === "paid") throw new Error("A paid run cannot be cancelled.");
  const releaseResult = await db().from("hr_pay_packages").update({ payroll_run_id: null, status: "approved" }).eq("payroll_run_id", runId);
  if (releaseResult.error) throw new Error(releaseResult.error.message);
  const updateResult = await db().from("hr_payroll_runs").update({ status: "cancelled" }).eq("id", runId);
  if (updateResult.error) throw new Error(updateResult.error.message);
}

export async function findPayrollRunByPeriod(auth: HrmsAuthContext, periodMonthInput: string) {
  const periodMonth = normalizedPeriod(periodMonthInput);
  const { data, error } = await db()
    .from("hr_payroll_runs")
    .select("id")
    .eq("company_id", auth.companyId)
    .eq("period_month", periodMonth)
    .neq("status", "cancelled")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string | undefined;
}

export async function listRunStations(
  auth: HrmsAuthContext,
  runId: string,
  filters?: { search?: string; sort?: string; page?: number | string; pageSize?: number }
) {
  await fetchRunOrThrow(auth, runId);
  const page = normalizePage(filters?.page);
  const pageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE;
  const search = filters?.search?.trim().toLowerCase() ?? "";
  const sort = filters?.sort ?? "name";

  let linesQuery = db()
    .from("hr_payroll_run_lines")
    .select("id, location_id, gross_earnings, total_deductions, net_pay, status")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId);
  if (!auth.allLocations) linesQuery = linesQuery.in("location_id", permittedLocationIds(auth));
  const linesResult = await linesQuery;
  if (linesResult.error) throw new Error(linesResult.error.message);

  const locations = await listLocations(auth);
  const locationById = new Map(locations.map((location) => [location.id, location]));
  const aggregates = new Map<string, RunStationRow>();

  for (const line of linesResult.data ?? []) {
    const stationId = line.location_id ?? UNASSIGNED_STATION_ID;
    if (stationId !== UNASSIGNED_STATION_ID && !auth.allLocations && !auth.locationIds.includes(stationId)) continue;
    if (stationId !== UNASSIGNED_STATION_ID && !locationById.has(stationId) && auth.allLocations) {
      // Station may be inactive/hidden; still show it with a fallback label.
    }
    const location = stationId === UNASSIGNED_STATION_ID ? null : locationById.get(stationId);
    const existing = aggregates.get(stationId) ?? {
      stationId,
      stationCode: location?.station_code ?? (stationId === UNASSIGNED_STATION_ID ? "—" : stationId.slice(0, 8)),
      stationName: location?.station_name ?? (stationId === UNASSIGNED_STATION_ID ? "Unassigned" : "Unknown station"),
      memberCount: 0,
      grossTotal: 0,
      deductionTotal: 0,
      netTotal: 0
    };
    existing.memberCount += 1;
    existing.grossTotal = roundMoney(existing.grossTotal + Number(line.gross_earnings ?? 0));
    existing.deductionTotal = roundMoney(existing.deductionTotal + Number(line.total_deductions ?? 0));
    existing.netTotal = roundMoney(existing.netTotal + Number(line.net_pay ?? 0));
    aggregates.set(stationId, existing);
  }

  // Ensure every permitted station appears even with zero members.
  for (const location of locations) {
    if (!aggregates.has(location.id)) {
      aggregates.set(location.id, {
        stationId: location.id,
        stationCode: location.station_code,
        stationName: location.station_name ?? location.station_code,
        memberCount: 0,
        grossTotal: 0,
        deductionTotal: 0,
        netTotal: 0
      });
    }
  }

  let rows = [...aggregates.values()];
  if (search) {
    rows = rows.filter((row) =>
      row.stationCode.toLowerCase().includes(search)
      || row.stationName.toLowerCase().includes(search)
    );
  }

  rows.sort((a, b) => {
    if (sort === "net") return b.netTotal - a.netTotal || a.stationCode.localeCompare(b.stationCode);
    if (sort === "members") return b.memberCount - a.memberCount || a.stationCode.localeCompare(b.stationCode);
    return a.stationCode.localeCompare(b.stationCode) || a.stationName.localeCompare(b.stationName);
  });

  const total = rows.length;
  const start = (page - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), total, page, pageSize };
}

export async function getStationLabel(auth: HrmsAuthContext, stationId: string) {
  if (stationId === UNASSIGNED_STATION_ID) return { stationId, stationCode: "—", stationName: "Unassigned" };
  const locations = await listLocations(auth);
  const location = locations.find((row) => row.id === stationId);
  if (!location) {
    const { data, error } = await db().from("stations").select("id, station_code, station_name").eq("company_id", auth.companyId).eq("id", stationId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return { stationId: data.id, stationCode: data.station_code, stationName: data.station_name ?? data.station_code };
  }
  return { stationId: location.id, stationCode: location.station_code, stationName: location.station_name ?? location.station_code };
}

export async function listStationRunMembers(auth: HrmsAuthContext, runId: string, stationId: string) {
  await fetchRunOrThrow(auth, runId);
  const locationId = resolveStationFilter(stationId);
  if (locationId && !auth.allLocations && !auth.locationIds.includes(locationId)) {
    throw new Error("You do not have access to this station.");
  }

  let query = db()
    .from("hr_payroll_run_lines")
    .select("*")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId)
    .order("payee_name");
  query = locationId === null ? query.is("location_id", null) : query.eq("location_id", locationId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as PayrollRunLineRow[];
}

export async function listStationEligiblePayees(auth: HrmsAuthContext, runId: string, stationId: string): Promise<PackagePayeeOption[]> {
  await fetchRunOrThrow(auth, runId);
  const locationId = resolveStationFilter(stationId);
  if (locationId && !auth.allLocations && !auth.locationIds.includes(locationId)) {
    throw new Error("You do not have access to this station.");
  }

  const existingResult = await db()
    .from("hr_payroll_run_lines")
    .select("payee_type, payee_id")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId);
  if (existingResult.error) throw new Error(existingResult.error.message);
  const existing = new Set((existingResult.data ?? []).map((row) => `${row.payee_type}:${row.payee_id}`));

  let employeesQuery = db()
    .from("employees")
    .select("id, employee_code, full_name, hr_pay_type")
    .eq("company_id", auth.companyId)
    .eq("is_active", true)
    .order("full_name");
  let contractorsQuery = db()
    .from("contractors")
    .select("id, dropx_id, full_name")
    .eq("company_id", auth.companyId)
    .eq("is_active", true)
    .order("full_name");

  employeesQuery = locationId === null ? employeesQuery.is("location_id", null) : employeesQuery.eq("location_id", locationId);
  contractorsQuery = locationId === null ? contractorsQuery.is("location_id", null) : contractorsQuery.eq("location_id", locationId);

  const [employeesResult, contractorsResult] = await Promise.all([employeesQuery, contractorsQuery]);
  if (employeesResult.error) throw new Error(employeesResult.error.message);
  if (contractorsResult.error) throw new Error(contractorsResult.error.message);

  return [
    ...(employeesResult.data ?? [])
      .filter((employee) => !existing.has(`employee:${employee.id}`))
      .map((employee) => ({
        id: employee.id,
        type: "employee" as const,
        name: employee.full_name,
        code: employee.employee_code
      })),
    ...(contractorsResult.data ?? [])
      .filter((contractor) => !existing.has(`contractor:${contractor.id}`))
      .map((contractor) => ({
        id: contractor.id,
        type: "contractor" as const,
        name: contractor.full_name,
        code: contractor.dropx_id
      }))
  ];
}

export async function addPayeeToRun(auth: HrmsAuthContext, runId: string, payeeType: PayeeType, payeeId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  if (run.status === "locked" || run.status === "paid") throw new Error("Locked or paid runs cannot accept new payees.");

  const existing = await db()
    .from("hr_payroll_run_lines")
    .select("id")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId)
    .eq("payee_type", payeeType)
    .eq("payee_id", payeeId)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) throw new Error("This member is already included in the run.");

  if (payeeType === "employee") {
    const employeeResult = await db()
      .from("employees")
      .select("id, employee_code, full_name, hr_pay_type, location_id")
      .eq("company_id", auth.companyId)
      .eq("id", payeeId)
      .eq("is_active", true)
      .maybeSingle();
    if (employeeResult.error) throw new Error(employeeResult.error.message);
    if (!employeeResult.data) throw new Error("Employee was not found.");
    if (!auth.allLocations && employeeResult.data.location_id && !auth.locationIds.includes(employeeResult.data.location_id)) {
      throw new Error("You do not have access to this station.");
    }
    const insertResult = await db().from("hr_payroll_run_lines").insert({
      company_id: auth.companyId,
      run_id: runId,
      payee_type: "employee",
      payee_id: employeeResult.data.id,
      payee_name: employeeResult.data.full_name,
      payee_code: employeeResult.data.employee_code,
      pay_type: employeeResult.data.hr_pay_type === "package" ? "package" : "monthly",
      location_id: employeeResult.data.location_id ?? null,
      status: "pending"
    }).select("id").single();
    if (insertResult.error || !insertResult.data) throw new Error(insertResult.error?.message ?? "Unable to add employee to the run.");
    await db().from("hr_payroll_runs").update({ payee_count: run.payee_count + 1 }).eq("id", runId);
    return insertResult.data.id as string;
  }

  const contractorResult = await db()
    .from("contractors")
    .select("id, dropx_id, full_name, location_id")
    .eq("company_id", auth.companyId)
    .eq("id", payeeId)
    .eq("is_active", true)
    .maybeSingle();
  if (contractorResult.error) throw new Error(contractorResult.error.message);
  if (!contractorResult.data) throw new Error("Contractor was not found.");
  if (!auth.allLocations && contractorResult.data.location_id && !auth.locationIds.includes(contractorResult.data.location_id)) {
    throw new Error("You do not have access to this station.");
  }
  const insertResult = await db().from("hr_payroll_run_lines").insert({
    company_id: auth.companyId,
    run_id: runId,
    payee_type: "contractor",
    payee_id: contractorResult.data.id,
    payee_name: contractorResult.data.full_name,
    payee_code: contractorResult.data.dropx_id,
    pay_type: "package",
    location_id: contractorResult.data.location_id ?? null,
    status: "pending"
  }).select("id").single();
  if (insertResult.error || !insertResult.data) throw new Error(insertResult.error?.message ?? "Unable to add contractor to the run.");
  await db().from("hr_payroll_runs").update({ payee_count: run.payee_count + 1 }).eq("id", runId);
  return insertResult.data.id as string;
}

export async function getPayrollRunLine(auth: HrmsAuthContext, runId: string, lineId: string) {
  const run = await fetchRunOrThrow(auth, runId);
  const lineResult = await db()
    .from("hr_payroll_run_lines")
    .select("*, hr_payroll_run_line_items(*)")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId)
    .eq("id", lineId)
    .maybeSingle();
  if (lineResult.error) throw new Error(lineResult.error.message);
  if (!lineResult.data) return null;
  const line = {
    ...lineResult.data,
    hr_payroll_run_line_items: ((lineResult.data.hr_payroll_run_line_items ?? []) as PayrollRunLineItemRow[]).sort((a, b) => a.display_order - b.display_order)
  } as PayrollRunLineRow;
  return { run, line };
}

export async function ensurePackageRateDefaults(auth: HrmsAuthContext) {
  const rows = PACKAGE_TYPES.map((packageType) => ({
    company_id: auth.companyId,
    package_type: packageType,
    rate: 0
  }));
  const result = await db().from("hr_package_rate_defaults").upsert(rows, { onConflict: "company_id,package_type", ignoreDuplicates: true });
  if (result.error) throw new Error(result.error.message);
}

export async function listPackageRateDefaults(auth: HrmsAuthContext) {
  await ensurePackageRateDefaults(auth);
  const { data, error } = await db()
    .from("hr_package_rate_defaults")
    .select("id, company_id, package_type, rate")
    .eq("company_id", auth.companyId)
    .order("package_type");
  if (error) throw new Error(error.message);
  return (data ?? []) as PackageRateDefaultRow[];
}

export async function savePackageRateDefaults(auth: HrmsAuthContext, rates: Array<{ packageType: PackageType; rate: number }>) {
  for (const item of rates) {
    if (!isPackageType(item.packageType)) throw new Error("Invalid package type.");
    if (!Number.isFinite(item.rate) || item.rate < 0) throw new Error(`Enter a valid rate for ${PACKAGE_TYPE_LABELS[item.packageType]}.`);
  }
  const rows = rates.map((item) => ({
    company_id: auth.companyId,
    package_type: item.packageType,
    rate: roundMoney(item.rate),
    updated_by: auth.userId
  }));
  const result = await db().from("hr_package_rate_defaults").upsert(rows, { onConflict: "company_id,package_type" });
  if (result.error) throw new Error(result.error.message);
}

export async function listPackageRateOverrides(auth: HrmsAuthContext, payeeType: PayeeType, payeeId: string) {
  const { data, error } = await db()
    .from("hr_package_rate_overrides")
    .select("id, company_id, payee_type, payee_id, package_type, rate")
    .eq("company_id", auth.companyId)
    .eq("payee_type", payeeType)
    .eq("payee_id", payeeId);
  if (error) throw new Error(error.message);
  return (data ?? []) as PackageRateOverrideRow[];
}

export async function savePackageRateOverrides(
  auth: HrmsAuthContext,
  payeeType: PayeeType,
  payeeId: string,
  rates: Array<{ packageType: PackageType; rate: number | null }>
) {
  for (const item of rates) {
    if (!isPackageType(item.packageType)) throw new Error("Invalid package type.");
    if (item.rate !== null && (!Number.isFinite(item.rate) || item.rate < 0)) {
      throw new Error(`Enter a valid override rate for ${PACKAGE_TYPE_LABELS[item.packageType]}.`);
    }
  }

  const toDelete = rates.filter((item) => item.rate === null).map((item) => item.packageType);
  if (toDelete.length) {
    const deleteResult = await db()
      .from("hr_package_rate_overrides")
      .delete()
      .eq("company_id", auth.companyId)
      .eq("payee_type", payeeType)
      .eq("payee_id", payeeId)
      .in("package_type", toDelete);
    if (deleteResult.error) throw new Error(deleteResult.error.message);
  }

  const toUpsert = rates.filter((item): item is { packageType: PackageType; rate: number } => item.rate !== null);
  if (toUpsert.length) {
    const rows = toUpsert.map((item) => ({
      company_id: auth.companyId,
      payee_type: payeeType,
      payee_id: payeeId,
      package_type: item.packageType,
      rate: roundMoney(item.rate),
      updated_by: auth.userId
    }));
    const upsertResult = await db().from("hr_package_rate_overrides").upsert(rows, { onConflict: "company_id,payee_type,payee_id,package_type" });
    if (upsertResult.error) throw new Error(upsertResult.error.message);
  }
}

export async function listPackageEntriesForLine(auth: HrmsAuthContext, runLineId: string) {
  const { data, error } = await db()
    .from("hr_payroll_package_entries")
    .select("id, company_id, run_id, run_line_id, payee_type, payee_id, package_type, quantity, rate, amount")
    .eq("company_id", auth.companyId)
    .eq("run_line_id", runLineId)
    .order("package_type");
  if (error) throw new Error(error.message);
  return (data ?? []) as PayrollPackageEntryRow[];
}

export async function listPackageEntriesForRunLines(auth: HrmsAuthContext, runId: string, lineIds: string[]) {
  if (!lineIds.length) return [] as PayrollPackageEntryRow[];
  const { data, error } = await db()
    .from("hr_payroll_package_entries")
    .select("id, company_id, run_id, run_line_id, payee_type, payee_id, package_type, quantity, rate, amount")
    .eq("company_id", auth.companyId)
    .eq("run_id", runId)
    .in("run_line_id", lineIds)
    .order("package_type");
  if (error) throw new Error(error.message);
  return (data ?? []) as PayrollPackageEntryRow[];
}

export type EffectivePackageRateRow = {
  packageType: PackageType;
  defaultRate: number;
  overrideRate: number | null;
  effectiveRate: number;
};

export async function getEffectivePackageRates(auth: HrmsAuthContext, payeeType: PayeeType, payeeId: string): Promise<EffectivePackageRateRow[]> {
  const [defaults, overrides] = await Promise.all([
    listPackageRateDefaults(auth),
    listPackageRateOverrides(auth, payeeType, payeeId)
  ]);
  const overrideByType = new Map(overrides.map((row) => [row.package_type, Number(row.rate)]));
  return PACKAGE_TYPES.map((packageType) => {
    const defaultRate = Number(defaults.find((row) => row.package_type === packageType)?.rate ?? 0);
    const overrideRate = overrideByType.has(packageType) ? overrideByType.get(packageType)! : null;
    return {
      packageType,
      defaultRate,
      overrideRate,
      effectiveRate: overrideRate ?? defaultRate
    };
  });
}

export async function upsertPackageEntries(
  auth: HrmsAuthContext,
  runLineId: string,
  entries: Array<{ packageType: PackageType; quantity: number; rate?: number }>
) {
  const lineResult = await db()
    .from("hr_payroll_run_lines")
    .select("id, run_id, payee_type, payee_id, pay_type")
    .eq("company_id", auth.companyId)
    .eq("id", runLineId)
    .maybeSingle();
  if (lineResult.error) throw new Error(lineResult.error.message);
  if (!lineResult.data) throw new Error("Payroll line was not found.");
  if (lineResult.data.pay_type !== "package") throw new Error("Package counts can only be saved for package-pay members.");

  const run = await fetchRunOrThrow(auth, lineResult.data.run_id);
  if (run.status === "locked" || run.status === "paid") throw new Error("Locked or paid runs cannot be edited.");

  const effectiveRates = await getEffectivePackageRates(auth, lineResult.data.payee_type as PayeeType, lineResult.data.payee_id);
  const rateByType = new Map(effectiveRates.map((row) => [row.packageType, row.effectiveRate]));

  const rows = PACKAGE_TYPES.map((packageType) => {
    const input = entries.find((entry) => entry.packageType === packageType);
    const quantity = Number(input?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity < 0) throw new Error(`Enter a valid count for ${PACKAGE_TYPE_LABELS[packageType]}.`);
    const rate = input?.rate !== undefined ? Number(input.rate) : (rateByType.get(packageType) ?? 0);
    if (!Number.isFinite(rate) || rate < 0) throw new Error(`Enter a valid rate for ${PACKAGE_TYPE_LABELS[packageType]}.`);
    const amount = roundMoney(quantity * rate);
    return {
      company_id: auth.companyId,
      run_id: lineResult.data!.run_id,
      run_line_id: runLineId,
      payee_type: lineResult.data!.payee_type,
      payee_id: lineResult.data!.payee_id,
      package_type: packageType,
      quantity,
      rate: roundMoney(rate),
      amount
    };
  });

  const upsertResult = await db().from("hr_payroll_package_entries").upsert(rows, { onConflict: "run_line_id,package_type" });
  if (upsertResult.error) throw new Error(upsertResult.error.message);

  // Keep draft/calculated lines in sync enough for station totals before full calculate.
  const packageGross = roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
  const updateResult = await db().from("hr_payroll_run_lines").update({
    gross_earnings: packageGross,
    total_deductions: 0,
    employer_contributions: 0,
    net_pay: packageGross,
    status: run.status === "calculated" ? "pending" : "pending",
    notes: packageGross > 0 ? "Package counts updated — recalculate the run to refresh statutory deductions." : null
  }).eq("id", runLineId);
  if (updateResult.error) throw new Error(updateResult.error.message);
  await recomputeRunTotals(auth, lineResult.data.run_id);
}
