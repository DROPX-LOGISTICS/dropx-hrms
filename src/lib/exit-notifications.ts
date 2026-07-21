import { sendEmail } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ExitNotificationEvent = "CASE_SUBMITTED" | "CASE_APPROVED" | "CASE_REJECTED" | "WITHDRAWAL_REQUESTED" | "TASK_ASSIGNED" | "TASK_COMPLETED" | "DOCUMENTS_GENERATED" | "CASE_CLOSED";

function fill(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([a-z0-9_]+)\s*}}/gi, (_, key: string) => values[key] ?? "");
}

function emails(rows: Array<{ email?: string | null }> | null | undefined) {
  return (rows ?? []).map((row) => String(row.email ?? "").trim().toLowerCase()).filter(Boolean);
}

export async function sendExitNotification(input: { caseId: string; companyId: string; event: ExitNotificationEvent; extra?: Record<string, string> }) {
  if (!supabaseAdmin) return;
  const [{ data: template }, { data: exitCase }] = await Promise.all([
    supabaseAdmin.from("hr_exit_notification_templates").select("*").eq("company_id", input.companyId).eq("event_code", input.event).eq("is_enabled", true).maybeSingle(),
    supabaseAdmin.from("hr_exit_cases").select("*, employees(id, employee_code, full_name, email, mobile, location_id, designation_id, designations(name))").eq("company_id", input.companyId).eq("id", input.caseId).maybeSingle()
  ]);
  if (!template || !exitCase) return;
  const employee = Array.isArray(exitCase.employees) ? exitCase.employees[0] : exitCase.employees;
  const { data: employeeProfile } = employee?.employee_code
    ? await supabaseAdmin.from("profiles").select("id, email, reports_to_user_id").eq("company_id", input.companyId).eq("employee_id", employee.employee_code).maybeSingle()
    : { data: null };
  const { data: manager } = employeeProfile?.reports_to_user_id
    ? await supabaseAdmin.from("profiles").select("id, email").eq("company_id", input.companyId).eq("id", employeeProfile.reports_to_user_id).maybeSingle()
    : { data: null };
  const { data: access } = await supabaseAdmin.from("hr_user_access").select("user_id").eq("company_id", input.companyId).eq("is_active", true).in("role_code", ["HRMS_ADMIN", "HR_MANAGER"]);
  const hrIds = (access ?? []).map((row) => row.user_id);
  const [{ data: hrProfiles }, { data: ownerProfiles }] = await Promise.all([
    hrIds.length
      ? supabaseAdmin.from("profiles").select("id, email").eq("company_id", input.companyId).in("id", hrIds).eq("is_active", true)
      : Promise.resolve({ data: [] }),
    supabaseAdmin.from("profiles").select("id, email").eq("company_id", input.companyId).eq("is_master_owner", true).eq("is_active", true)
  ]);
  const { data: owner } = exitCase.hr_owner_user_id
    ? await supabaseAdmin.from("profiles").select("email").eq("company_id", input.companyId).eq("id", exitCase.hr_owner_user_id).maybeSingle()
    : { data: null };
  const taskOwnerId = input.extra?.task_owner_id;
  const { data: taskOwner } = taskOwnerId
    ? await supabaseAdmin.from("profiles").select("email").eq("company_id", input.companyId).eq("id", taskOwnerId).maybeSingle()
    : { data: null };
  const groups: Record<string, string[]> = {
    EMPLOYEE: [exitCase.personal_email, employee?.email].map(String).filter(Boolean),
    REPORTING_MANAGER: manager?.email ? [manager.email] : [],
    HR_TEAM: emails([...(hrProfiles ?? []), ...(ownerProfiles ?? [])]),
    HR_OWNER: owner?.email ? [owner.email] : [],
    TASK_OWNER: taskOwner?.email ? [taskOwner.email] : []
  };
  const resolve = (keys: string[], custom: string[]) => Array.from(new Set([...keys.flatMap((key) => groups[key] ?? []), ...custom].map((value) => value.trim().toLowerCase()).filter(Boolean)));
  const to = resolve(template.to_recipients ?? [], template.custom_to_emails ?? []);
  const cc = resolve(template.cc_recipients ?? [], template.custom_cc_emails ?? []).filter((value) => !to.includes(value));
  const values: Record<string, string> = {
    case_number: exitCase.case_number,
    employee_name: employee?.full_name ?? "Employee",
    employee_code: employee?.employee_code ?? "",
    requested_last_working_date: exitCase.requested_last_working_date ?? "",
    last_working_date: exitCase.approved_last_working_date ?? exitCase.effective_date ?? exitCase.requested_last_working_date ?? "",
    task_name: input.extra?.task_name ?? "",
    task_due_date: input.extra?.task_due_date ?? "",
    ...input.extra
  };
  const subject = fill(template.subject_template, values);
  const body = fill(template.body_template, values);
  let status = "sent";
  let errorMessage: string | null = null;
  try {
    if (!to.length) {
      status = "skipped";
      errorMessage = "No recipients resolved from the notification master.";
    } else {
      await sendEmail({ companyId: input.companyId, to, cc, subject, body });
    }
  } catch (error) {
    status = "failed";
    errorMessage = error instanceof Error ? error.message : "Email delivery failed.";
  }
  await supabaseAdmin.from("hr_exit_notification_log").insert({
    company_id: input.companyId, case_id: input.caseId, event_code: input.event,
    to_emails: to, cc_emails: cc, subject, status, error_message: errorMessage
  });
}
