import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

function numericId(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return /^\d{1,20}$/.test(digits) ? Number(digits) : null;
}

async function loadNumericIds(companyId: string, table: string, column: string) {
  if (!supabaseAdmin) return [] as number[];
  const { data, error } = await supabaseAdmin.from(table).select(column).eq("company_id", companyId).not(column, "is", null);
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("does not exist") || message.includes("schema cache")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => numericId((row as unknown as Record<string, unknown>)[column])).filter((value): value is number => value !== null);
}

async function loadStartNumber(companyId: string) {
  if (!supabaseAdmin) return 1;
  const { data, error } = await supabaseAdmin.from("biometric_middleware_settings").select("enrolment_start_number").eq("company_id", companyId).eq("id", true).maybeSingle();
  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("does not exist") || message.includes("schema cache")) return 1;
    throw new Error(error.message);
  }
  const start = Number((data as { enrolment_start_number?: unknown } | null)?.enrolment_start_number);
  return Number.isInteger(start) && start > 0 ? start : 1;
}

export async function generateBiometricEnrolmentId(companyId: string) {
  const [enrolments, employees, fieldExecutives, startNumber] = await Promise.all([
    loadNumericIds(companyId, "biometric_enrolments", "enrolment_id"),
    loadNumericIds(companyId, "employees", "biometric_id"),
    // Collision prevention only: field executives are never shown or created by HRMS.
    loadNumericIds(companyId, "field_executives", "biometric_id"),
    loadStartNumber(companyId)
  ]);
  const used = new Set([...enrolments, ...employees, ...fieldExecutives]);
  let next = Math.max(startNumber - 1, ...Array.from(used).filter((value) => value > 0 && value < 9000)) + 1;
  while (used.has(next)) next += 1;
  return String(next);
}

export async function syncEmployeeBiometricEnrolment(input: {
  companyId: string;
  createdBy: string;
  effectiveFrom: string;
  employeeId: string;
  enrolmentId: string;
  isActive?: boolean;
  locationId: string;
}) {
  if (!supabaseAdmin) throw new Error("Supabase service role key is not configured.");
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const deactivateResult = await supabaseAdmin.from("biometric_enrolments").update({ status: "Inactive", effective_to: today, updated_at: now }).eq("company_id", input.companyId).eq("employee_id", input.employeeId).is("effective_to", null).neq("enrolment_id", input.enrolmentId);
  if (deactivateResult.error) throw new Error(deactivateResult.error.message);
  const existingResult = await supabaseAdmin.from("biometric_enrolments").select("id, employee_id").eq("company_id", input.companyId).eq("worker_type", "employee").eq("enrolment_id", input.enrolmentId).is("effective_to", null).maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  const existing = existingResult.data as { id: string; employee_id: string | null } | null;
  if (existing && existing.employee_id !== input.employeeId) throw new Error("Biometric enrolment ID is already assigned to another worker.");
  const payload = {
    company_id: input.companyId,
    enrolment_id: input.enrolmentId,
    worker_type: "employee",
    employee_id: input.employeeId,
    field_executive_id: null,
    location_id: input.locationId,
    status: input.isActive === false ? "Inactive" : "Active",
    effective_from: input.effectiveFrom,
    effective_to: input.isActive === false ? today : null,
    created_by: input.createdBy,
    updated_at: now
  };
  const result = existing
    ? await supabaseAdmin.from("biometric_enrolments").update(payload).eq("id", existing.id).eq("company_id", input.companyId)
    : await supabaseAdmin.from("biometric_enrolments").insert(payload);
  if (result.error) throw new Error(result.error.message);
}

export async function syncContractorBiometricEnrolment(input: {
  companyId: string;
  createdBy: string;
  effectiveFrom: string;
  contractorId: string;
  enrolmentId: string;
  isActive?: boolean;
  locationId: string;
}) {
  if (!supabaseAdmin) throw new Error("Supabase service role key is not configured.");
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const deactivate = await supabaseAdmin
    .from("biometric_enrolments")
    .update({ status: "Inactive", effective_to: today, updated_at: now })
    .eq("company_id", input.companyId)
    .eq("profile_type", "contractor")
    .eq("account_id", input.contractorId)
    .is("effective_to", null)
    .neq("enrolment_id", input.enrolmentId);
  if (deactivate.error) throw new Error(deactivate.error.message);

  const existingResult = await supabaseAdmin
    .from("biometric_enrolments")
    .select("id, account_id")
    .eq("company_id", input.companyId)
    .eq("profile_type", "contractor")
    .eq("enrolment_id", input.enrolmentId)
    .is("effective_to", null)
    .maybeSingle();
  if (existingResult.error) throw new Error(existingResult.error.message);
  if (existingResult.data && existingResult.data.account_id !== input.contractorId) {
    throw new Error("Biometric enrolment ID is already assigned to another worker.");
  }

  const isActive = input.isActive !== false;
  const payload = {
    company_id: input.companyId,
    enrolment_id: input.enrolmentId,
    worker_type: "individual_contract",
    profile_type: "contractor",
    account_id: input.contractorId,
    employee_id: null,
    field_executive_id: null,
    location_id: input.locationId,
    status: isActive ? "Active" : "Inactive",
    effective_from: input.effectiveFrom,
    effective_to: isActive ? null : today,
    created_by: input.createdBy,
    updated_at: now
  };
  const result = existingResult.data
    ? await supabaseAdmin.from("biometric_enrolments").update(payload).eq("id", existingResult.data.id).eq("company_id", input.companyId)
    : await supabaseAdmin.from("biometric_enrolments").insert(payload);
  if (result.error) throw new Error(result.error.message);
}
