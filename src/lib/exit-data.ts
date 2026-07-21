import { HrmsAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

function requireDb() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}

export async function listExitCases(auth: HrmsAuthContext, filters?: { search?: string; status?: string; scenario?: string }) {
  let query = requireDb().from("hr_exit_cases")
    .select("id, case_number, scenario, status, current_stage, requested_last_working_date, approved_last_working_date, submitted_at, employees(employee_code, full_name, email, location_id, stations(station_code), designations(name)), hr_exit_reasons(name)")
    .eq("company_id", auth.companyId).order("submitted_at", { ascending: false });
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.scenario) query = query.eq("scenario", filters.scenario);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const search = String(filters?.search ?? "").trim().toLowerCase();
  return search ? (data ?? []).filter((row) => {
    const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    return [row.case_number, employee?.employee_code, employee?.full_name, employee?.email].some((value) => String(value ?? "").toLowerCase().includes(search));
  }) : data ?? [];
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

export async function loadExitMasters(auth: HrmsAuthContext) {
  const db = requireDb();
  const [policy, reasons, steps, tasks, documents, notifications] = await Promise.all([
    db.from("hr_exit_policies").select("*").eq("company_id", auth.companyId).maybeSingle(),
    db.from("hr_exit_reasons").select("*").eq("company_id", auth.companyId).order("scenario").order("display_order"),
    db.from("hr_exit_workflow_steps").select("*").eq("company_id", auth.companyId).order("scenario").order("step_order"),
    db.from("hr_exit_task_templates").select("*").eq("company_id", auth.companyId).order("category").order("display_order"),
    db.from("hr_exit_document_templates").select("*").eq("company_id", auth.companyId).order("document_type").order("version", { ascending: false }),
    db.from("hr_exit_notification_templates").select("*").eq("company_id", auth.companyId).order("event_code")
  ]);
  for (const result of [policy, reasons, steps, tasks, documents, notifications]) if (result.error) throw new Error(result.error.message);
  return { policy: policy.data, reasons: reasons.data ?? [], steps: steps.data ?? [], tasks: tasks.data ?? [], documents: documents.data ?? [], notifications: notifications.data ?? [] };
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
