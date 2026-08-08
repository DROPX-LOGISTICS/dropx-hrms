import { unstable_cache } from "next/cache";
import { HrmsAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_PAGE_SIZE = 25;
const OPEN_STATUSES = ["submitted", "under_review", "approved", "notice_period", "clearance", "documents_ready", "on_hold", "withdrawal_requested"];
const CLEARANCE_STATUSES = ["clearance", "ready_to_close"];

function requireDb() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}

function normalizePage(page?: number | string) {
  const value = typeof page === "string" ? Number.parseInt(page, 10) : page;
  return Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : 1;
}

export async function listExitCases(auth: HrmsAuthContext, filters?: { search?: string; status?: string; scenario?: string; page?: number | string; pageSize?: number }) {
  const page = normalizePage(filters?.page);
  const pageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE;
  const db = requireDb();
  const safeSearch = String(filters?.search ?? "").replace(/[,()%]/g, " ").trim();

  let query = db.from("hr_exit_cases")
    .select("id, case_number, scenario, status, current_stage, requested_last_working_date, approved_last_working_date, submitted_at, employees(employee_code, full_name, email, location_id, stations(station_code), designations(name)), hr_exit_reasons(name)", { count: "exact" })
    .eq("company_id", auth.companyId).order("submitted_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.scenario) query = query.eq("scenario", filters.scenario);

  if (safeSearch) {
    const { data: matchedEmployees } = await db.from("employees").select("id").eq("company_id", auth.companyId).or(`full_name.ilike.%${safeSearch}%,employee_code.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
    const employeeIds = (matchedEmployees ?? []).map((row) => row.id);
    const orClauses = [`case_number.ilike.%${safeSearch}%`];
    if (employeeIds.length) orClauses.push(`employee_id.in.(${employeeIds.join(",")})`);
    query = query.or(orClauses.join(","));
  }

  query = query.range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function getExitCaseStats(auth: HrmsAuthContext) {
  const db = requireDb();
  const base = () => db.from("hr_exit_cases").select("id", { count: "exact", head: true }).eq("company_id", auth.companyId);
  const [openResult, clearanceResult, readyResult, closedResult] = await Promise.all([
    base().in("status", OPEN_STATUSES),
    base().or(`status.in.(${CLEARANCE_STATUSES.join(",")}),current_stage.eq.clearance`),
    base().eq("status", "documents_ready"),
    base().eq("status", "closed")
  ]);
  for (const result of [openResult, clearanceResult, readyResult, closedResult]) if (result.error) throw new Error(result.error.message);
  return { open: openResult.count ?? 0, clearance: clearanceResult.count ?? 0, ready: readyResult.count ?? 0, closed: closedResult.count ?? 0 };
}

export async function getExitCase(auth: HrmsAuthContext, id: string) {
  const db = requireDb();
  const [{ data: exitCase, error }, approvals, tasks, settlement, documents, events, notifications] = await Promise.all([
    db.from("hr_exit_cases").select("*, employees(*, stations(station_code, station_name), designations(code, name)), hr_exit_reasons(name, code)").eq("company_id", auth.companyId).eq("id", id).maybeSingle(),
    db.from("hr_exit_approvals").select("*").eq("company_id", auth.companyId).eq("case_id", id).order("step_order"),
    db.from("hr_exit_tasks").select("*").eq("company_id", auth.companyId).eq("case_id", id).order("created_at"),
    db.from("hr_exit_settlement_items").select("*").eq("company_id", auth.companyId).eq("case_id", id).order("created_at"),
    db.from("hr_exit_documents").select("*").eq("company_id", auth.companyId).eq("case_id", id).order("generated_at", { ascending: false }),
    db.from("hr_exit_events").select("*").eq("company_id", auth.companyId).eq("case_id", id).order("created_at", { ascending: false }),
    db.from("hr_exit_notification_log").select("*").eq("company_id", auth.companyId).eq("case_id", id).order("created_at", { ascending: false })
  ]);
  if (error) throw new Error(error.message);
  if (!exitCase) return null;
  const employee = Array.isArray(exitCase.employees) ? exitCase.employees[0] : exitCase.employees;
  const photoResult = employee?.profile_photo_path
    ? await db.storage.from("employee-profile-documents").createSignedUrl(employee.profile_photo_path, 60 * 60)
    : { data: null };
  return {
    exitCase,
    employeePhotoUrl: photoResult.data?.signedUrl ?? null,
    approvals: approvals.data ?? [], tasks: tasks.data ?? [], settlement: settlement.data ?? [],
    documents: documents.data ?? [], events: events.data ?? [], notifications: notifications.data ?? []
  };
}

const getCachedExitMasters = unstable_cache(async (companyId: string) => {
  const db = requireDb();
  const [policy, reasons, steps, tasks, documents, notifications] = await Promise.all([
    db.from("hr_exit_policies").select("*").eq("company_id", companyId).maybeSingle(),
    db.from("hr_exit_reasons").select("*").eq("company_id", companyId).order("scenario").order("display_order"),
    db.from("hr_exit_workflow_steps").select("*").eq("company_id", companyId).order("scenario").order("step_order"),
    db.from("hr_exit_task_templates").select("*").eq("company_id", companyId).order("category").order("display_order"),
    db.from("hr_exit_document_templates").select("*").eq("company_id", companyId).order("document_type").order("version", { ascending: false }),
    db.from("hr_exit_notification_templates").select("*").eq("company_id", companyId).order("event_code")
  ]);
  for (const result of [policy, reasons, steps, tasks, documents, notifications]) if (result.error) throw new Error(result.error.message);
  return { policy: policy.data, reasons: reasons.data ?? [], steps: steps.data ?? [], tasks: tasks.data ?? [], documents: documents.data ?? [], notifications: notifications.data ?? [] };
}, ["hrms-exit-masters-v1"], { revalidate: 30 });

export async function loadExitMasters(auth: HrmsAuthContext) {
  return getCachedExitMasters(auth.companyId);
}

export async function listExitEligibleEmployees(auth: HrmsAuthContext) {
  let query = requireDb().from("employees").select("id, employee_code, full_name, email, date_of_join, location_id, stations(station_code), designations(name)").eq("company_id", auth.companyId).eq("is_active", true).order("full_name");
  if (!auth.allLocations && auth.locationIds.length) query = query.in("location_id", auth.locationIds);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const { data: open } = await requireDb().from("hr_exit_cases").select("employee_id").eq("company_id", auth.companyId).not("status", "in", '("closed","rejected","withdrawn","cancelled")');
  const blocked = new Set((open ?? []).map((row) => row.employee_id));
  return (data ?? []).filter((row) => !blocked.has(row.id));
}
