"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { createExitPdf, fillExitTemplate } from "@/lib/exit-documents";
import { sendExitNotification } from "@/lib/exit-notifications";
import { supabaseAdmin } from "@/lib/supabase/admin";

function db() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}
function text(value: FormDataEntryValue | null) { return String(value ?? "").trim(); }
function optional(value: FormDataEntryValue | null) { return text(value) || null; }
function isoDate(value: FormDataEntryValue | null, label: string) {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error(`${label} is required.`);
  return result;
}
function target(caseId: string, kind: "error" | "notice", message: string) { return `/exits/${caseId}?${kind}=${encodeURIComponent(message)}`; }
function rethrowRedirect(error: unknown) {
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  if (digest.startsWith("NEXT_REDIRECT")) throw error;
}
async function event(input: { companyId: string; caseId: string; code: string; title: string; actorId?: string | null; actorName?: string | null; details?: Record<string, unknown> }) {
  await db().from("hr_exit_events").insert({ company_id: input.companyId, case_id: input.caseId, event_code: input.code, title: input.title, actor_user_id: input.actorId, actor_name: input.actorName, details: input.details ?? {} });
}
async function loadCase(companyId: string, caseId: string) {
  const { data, error } = await db().from("hr_exit_cases").select("*").eq("company_id", companyId).eq("id", caseId).maybeSingle();
  if (error || !data) throw new Error(error?.message || "Exit case was not found.");
  return data;
}
async function resolveRoleUser(companyId: string, employeeCode: string | null, role: string) {
  if (role === "REPORTING_MANAGER" && employeeCode) {
    const { data: profile } = await db().from("profiles").select("reports_to_user_id").eq("company_id", companyId).eq("employee_id", employeeCode).maybeSingle();
    return profile?.reports_to_user_id ?? null;
  }
  if (["HR_MANAGER", "HRMS_ADMIN"].includes(role)) {
    const { data } = await db().from("hr_user_access").select("user_id").eq("company_id", companyId).eq("role_code", role).eq("is_active", true).limit(1).maybeSingle();
    return data?.user_id ?? null;
  }
  if (role === "OWNER") {
    const { data } = await db().from("profiles").select("id").eq("company_id", companyId).eq("is_master_owner", true).eq("is_active", true).limit(1).maybeSingle();
    return data?.id ?? null;
  }
  return null;
}

export async function createTerminationCase(formData: FormData) {
  const auth = await requireHrmsAuth("exit.manage");
  try {
    const employeeId = text(formData.get("employee_id"));
    const reasonId = text(formData.get("reason_id"));
    const effectiveDate = isoDate(formData.get("effective_date"), "Effective date");
    const confidentialReason = text(formData.get("confidential_reason"));
    if (!employeeId || !reasonId || confidentialReason.length < 3) throw new Error("Employee, termination reason and detailed rationale are required.");
    const [{ data: policy }, { data: employee }, { data: reason }] = await Promise.all([
      db().from("hr_exit_policies").select("*").eq("company_id", auth.companyId).maybeSingle(),
      db().from("employees").select("id, employee_code, full_name, email, mobile, is_active").eq("company_id", auth.companyId).eq("id", employeeId).maybeSingle(),
      db().from("hr_exit_reasons").select("id, name, default_rehire_eligible").eq("company_id", auth.companyId).eq("scenario", "termination").eq("id", reasonId).eq("is_active", true).maybeSingle()
    ]);
    if (!employee?.is_active || !reason) throw new Error("The selected employee or termination reason is unavailable.");
    const prefix = policy?.case_number_prefix ?? "EXIT";
    const { data: caseNumber, error: numberError } = await db().rpc("hr_next_exit_case_number", { p_company_id: auth.companyId, p_prefix: prefix });
    if (numberError) throw new Error(numberError.message);
    const managerUserId = await resolveRoleUser(auth.companyId, employee.employee_code, "REPORTING_MANAGER");
    const { data: exitCase, error } = await db().from("hr_exit_cases").insert({
      company_id: auth.companyId, case_number: caseNumber, employee_id: employee.id, source: "hr", scenario: "termination",
      reason_id: reason.id, confidential_reason: confidentialReason, requested_last_working_date: effectiveDate, effective_date: effectiveDate,
      notice_days: policy?.termination_notice_days ?? 0, status: "submitted", current_stage: "review", manager_user_id: managerUserId,
      hr_owner_user_id: auth.userId, personal_email: employee.email, personal_mobile: employee.mobile,
      rehire_eligible: reason.default_rehire_eligible, submitted_by: auth.userId
    }).select("id").single();
    if (error) throw new Error(error.message);
    await instantiateCase(exitCase.id, auth.companyId, "termination", employee.employee_code, effectiveDate, policy?.auto_create_tasks !== false);
    await event({ companyId: auth.companyId, caseId: exitCase.id, code: "CASE_SUBMITTED", title: "Termination case created", actorId: auth.userId, actorName: auth.fullName, details: { reason: reason.name } });
    await sendExitNotification({ caseId: exitCase.id, companyId: auth.companyId, event: "CASE_SUBMITTED" });
    revalidatePath("/exits"); redirect(`/exits/${exitCase.id}?notice=${encodeURIComponent("Termination case created and routed for approval.")}`);
  } catch (error) {
    rethrowRedirect(error);
    redirect(`/exits?create=termination&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create termination case.")}`);
  }
}

async function instantiateCase(caseId: string, companyId: string, scenario: string, employeeCode: string | null, lastDate: string, createTasks: boolean) {
  const { data: steps, error } = await db().from("hr_exit_workflow_steps").select("*").eq("company_id", companyId).eq("scenario", scenario).eq("is_active", true).order("step_order");
  if (error) throw new Error(error.message);
  if ((steps ?? []).length) {
    const rows = await Promise.all((steps ?? []).map(async (step) => ({
      company_id: companyId, case_id: caseId, workflow_step_id: step.id, step_order: step.step_order, step_name: step.name,
      approver_role: step.approver_role, assigned_user_id: await resolveRoleUser(companyId, employeeCode, step.approver_role), is_required: step.is_required
    })));
    const inserted = await db().from("hr_exit_approvals").insert(rows);
    if (inserted.error) throw new Error(inserted.error.message);
  }
  if (!createTasks) return;
  const { data: templates, error: taskError } = await db().from("hr_exit_task_templates").select("*").eq("company_id", companyId).eq("is_active", true).in("scenario", [scenario, "all"]).order("display_order");
  if (taskError) throw new Error(taskError.message);
  if ((templates ?? []).length) {
    const base = new Date(`${lastDate}T00:00:00Z`);
    const rows = await Promise.all((templates ?? []).map(async (template) => {
      const due = new Date(base); due.setUTCDate(due.getUTCDate() + template.due_offset_days);
      return { company_id: companyId, case_id: caseId, template_id: template.id, category: template.category, code: template.code, name: template.name,
        instructions: template.instructions, owner_role: template.owner_role, owner_user_id: await resolveRoleUser(companyId, employeeCode, template.owner_role),
        due_date: due.toISOString().slice(0, 10), is_required: template.is_required };
    }));
    const inserted = await db().from("hr_exit_tasks").insert(rows);
    if (inserted.error) throw new Error(inserted.error.message);
  }
}

export async function reviewExitApproval(formData: FormData) {
  const auth = await requireHrmsAuth("exit.approve");
  const caseId = text(formData.get("case_id"));
  try {
    const approvalId = text(formData.get("approval_id"));
    const decision = text(formData.get("decision"));
    const comments = optional(formData.get("comments"));
    if (!caseId || !approvalId || !["approved", "rejected"].includes(decision)) throw new Error("Invalid approval action.");
    const { data: approval } = await db().from("hr_exit_approvals").select("*").eq("company_id", auth.companyId).eq("case_id", caseId).eq("id", approvalId).maybeSingle();
    if (!approval || approval.status !== "pending") throw new Error("This approval is no longer pending.");
    const { data: earlier } = await db().from("hr_exit_approvals").select("id").eq("case_id", caseId).eq("is_required", true).lt("step_order", approval.step_order).neq("status", "approved").limit(1);
    if (earlier?.length) throw new Error("Complete the earlier approval step first.");
    if (approval.assigned_user_id && approval.assigned_user_id !== auth.userId && !["OWNER", "HRMS_ADMIN"].includes(auth.roleCode)) throw new Error("This approval is assigned to another user.");
    const update = await db().from("hr_exit_approvals").update({ status: decision, comments, acted_by: auth.userId, acted_at: new Date().toISOString() }).eq("id", approvalId);
    if (update.error) throw new Error(update.error.message);
    const exitCase = await loadCase(auth.companyId, caseId);
    if (decision === "rejected") {
      await db().from("hr_exit_cases").update({ status: "rejected", reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }).eq("id", caseId);
      await event({ companyId: auth.companyId, caseId, code: "CASE_REJECTED", title: `${approval.step_name} rejected`, actorId: auth.userId, actorName: auth.fullName, details: { comments } });
      await sendExitNotification({ caseId, companyId: auth.companyId, event: "CASE_REJECTED" });
    } else {
      const { data: remaining } = await db().from("hr_exit_approvals").select("id").eq("case_id", caseId).eq("is_required", true).eq("status", "pending").limit(1);
      await event({ companyId: auth.companyId, caseId, code: "APPROVAL_COMPLETED", title: `${approval.step_name} approved`, actorId: auth.userId, actorName: auth.fullName, details: { comments } });
      if (!remaining?.length) {
        const lastDate = exitCase.approved_last_working_date ?? exitCase.effective_date ?? exitCase.requested_last_working_date;
        await db().from("hr_exit_cases").update({ status: "approved", current_stage: "notice", approved_last_working_date: lastDate, reviewed_by: auth.userId, reviewed_at: new Date().toISOString() }).eq("id", caseId);
        await event({ companyId: auth.companyId, caseId, code: "CASE_APPROVED", title: "Exit request fully approved", actorId: auth.userId, actorName: auth.fullName });
        await sendExitNotification({ caseId, companyId: auth.companyId, event: "CASE_APPROVED" });
      }
    }
    revalidatePath(`/exits/${caseId}`); revalidatePath("/exits"); redirect(target(caseId, "notice", `Approval ${decision}.`));
  } catch (error) { rethrowRedirect(error); redirect(target(caseId, "error", error instanceof Error ? error.message : "Unable to review approval.")); }
}

export async function updateExitCase(formData: FormData) {
  const auth = await requireHrmsAuth("exit.manage");
  const caseId = text(formData.get("case_id"));
  try {
    const status = text(formData.get("status"));
    const allowed = ["approved","notice_period","clearance","on_hold","cancelled","withdrawn"];
    if (!allowed.includes(status)) throw new Error("Invalid case status.");
    const payload: Record<string, unknown> = { status };
    const lastWorkingDate = optional(formData.get("approved_last_working_date"));
    if (lastWorkingDate) payload.approved_last_working_date = isoDate(formData.get("approved_last_working_date"), "Last working date");
    if (status === "clearance") payload.current_stage = "clearance";
    if (status === "notice_period") payload.current_stage = "notice";
    const result = await db().from("hr_exit_cases").update(payload).eq("company_id", auth.companyId).eq("id", caseId);
    if (result.error) throw new Error(result.error.message);
    await event({ companyId: auth.companyId, caseId, code: "CASE_UPDATED", title: `Case updated to ${status.replaceAll("_", " ")}`, actorId: auth.userId, actorName: auth.fullName, details: payload });
    revalidatePath(`/exits/${caseId}`); revalidatePath("/exits"); redirect(target(caseId, "notice", "Exit case updated."));
  } catch (error) { rethrowRedirect(error); redirect(target(caseId, "error", error instanceof Error ? error.message : "Unable to update case.")); }
}

export async function updateExitTask(formData: FormData) {
  const auth = await requireHrmsAuth("exit.manage");
  const caseId = text(formData.get("case_id"));
  try {
    const taskId = text(formData.get("task_id"));
    const status = text(formData.get("status"));
    const note = optional(formData.get("completion_note"));
    if (!taskId || !["pending","in_progress","completed","waived","blocked"].includes(status)) throw new Error("Invalid task update.");
    if (["completed","waived","blocked"].includes(status) && !note) throw new Error("Add a completion or exception note.");
    const { data: task } = await db().from("hr_exit_tasks").select("*").eq("company_id", auth.companyId).eq("case_id", caseId).eq("id", taskId).maybeSingle();
    if (!task) throw new Error("Task was not found.");
    const update = await db().from("hr_exit_tasks").update({ status, completion_note: note, completed_by: ["completed","waived"].includes(status) ? auth.userId : null, completed_at: ["completed","waived"].includes(status) ? new Date().toISOString() : null }).eq("id", taskId);
    if (update.error) throw new Error(update.error.message);
    await event({ companyId: auth.companyId, caseId, code: "TASK_UPDATED", title: `${task.name}: ${status.replaceAll("_", " ")}`, actorId: auth.userId, actorName: auth.fullName, details: { note } });
    if (status === "completed") await sendExitNotification({ caseId, companyId: auth.companyId, event: "TASK_COMPLETED", extra: { task_name: task.name } });
    revalidatePath(`/exits/${caseId}`); redirect(target(caseId, "notice", "Task updated."));
  } catch (error) { rethrowRedirect(error); redirect(target(caseId, "error", error instanceof Error ? error.message : "Unable to update task.")); }
}

export async function saveSettlementItem(formData: FormData) {
  const auth = await requireHrmsAuth("exit.manage");
  const caseId = text(formData.get("case_id"));
  try {
    const code = text(formData.get("code")).toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const label = text(formData.get("label"));
    const itemType = text(formData.get("item_type"));
    const amount = Number(formData.get("amount"));
    if (!code || !label || !["earning","deduction"].includes(itemType) || !Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid settlement item.");
    const result = await db().from("hr_exit_settlement_items").upsert({ company_id: auth.companyId, case_id: caseId, code, label, item_type: itemType, amount, notes: optional(formData.get("notes")), created_by: auth.userId }, { onConflict: "case_id,code" });
    if (result.error) throw new Error(result.error.message);
    await db().from("hr_exit_cases").update({ settlement_status: "draft", current_stage: "settlement" }).eq("id", caseId);
    await event({ companyId: auth.companyId, caseId, code: "SETTLEMENT_ITEM_SAVED", title: `${label} added to settlement`, actorId: auth.userId, actorName: auth.fullName, details: { itemType, amount } });
    revalidatePath(`/exits/${caseId}`); redirect(target(caseId, "notice", "Settlement item saved."));
  } catch (error) { rethrowRedirect(error); redirect(target(caseId, "error", error instanceof Error ? error.message : "Unable to save settlement item.")); }
}

export async function approveSettlement(formData: FormData) {
  const auth = await requireHrmsAuth("exit.manage");
  const caseId = text(formData.get("case_id"));
  try {
    const status = text(formData.get("settlement_status"));
    if (!["approved","paid","not_applicable"].includes(status)) throw new Error("Invalid settlement status.");
    const result = await db().from("hr_exit_cases").update({ settlement_status: status, settlement_approved_by: auth.userId, settlement_approved_at: new Date().toISOString(), current_stage: "documents" }).eq("company_id", auth.companyId).eq("id", caseId);
    if (result.error) throw new Error(result.error.message);
    await event({ companyId: auth.companyId, caseId, code: "SETTLEMENT_APPROVED", title: `Settlement marked ${status.replaceAll("_", " ")}`, actorId: auth.userId, actorName: auth.fullName });
    revalidatePath(`/exits/${caseId}`); redirect(target(caseId, "notice", "Settlement status updated."));
  } catch (error) { rethrowRedirect(error); redirect(target(caseId, "error", error instanceof Error ? error.message : "Unable to approve settlement.")); }
}

export async function generateExitDocuments(formData: FormData) {
  const auth = await requireHrmsAuth("exit.manage");
  const caseId = text(formData.get("case_id"));
  try {
    const exitCase = await loadCase(auth.companyId, caseId);
    const [{ data: employee }, { data: policy }, { data: templates }, { data: tasks }, { data: approvals }, { data: items }] = await Promise.all([
      db().from("employees").select("*, designations(name), stations(station_code, station_name)").eq("company_id", auth.companyId).eq("id", exitCase.employee_id).single(),
      db().from("hr_exit_policies").select("*").eq("company_id", auth.companyId).maybeSingle(),
      db().from("hr_exit_document_templates").select("*").eq("company_id", auth.companyId).eq("is_active", true).order("version", { ascending: false }),
      db().from("hr_exit_tasks").select("status, is_required").eq("case_id", caseId),
      db().from("hr_exit_approvals").select("status, is_required").eq("case_id", caseId),
      db().from("hr_exit_settlement_items").select("label, item_type, amount").eq("case_id", caseId).order("created_at")
    ]);
    if (!employee) throw new Error("Employee record is unavailable.");
    if (!exitCase.approved_last_working_date && !exitCase.effective_date) throw new Error("Approve the final working date first.");
    if ((approvals ?? []).some((row) => row.is_required && row.status !== "approved")) throw new Error("All required approvals must be completed first.");
    if ((tasks ?? []).some((row) => row.is_required && !["completed","waived"].includes(row.status))) throw new Error("All required handover and clearance tasks must be completed or waived first.");
    if (!["approved","paid","not_applicable"].includes(exitCase.settlement_status)) throw new Error("Approve the settlement or mark it not applicable first.");
    const relation = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;
    const designation = relation(employee.designations as { name?: string } | { name?: string }[] | null);
    const reasonResult = exitCase.reason_id ? await db().from("hr_exit_reasons").select("name").eq("id", exitCase.reason_id).maybeSingle() : { data: null };
    const earnings = (items ?? []).filter((item) => item.item_type === "earning").reduce((sum, item) => sum + Number(item.amount), 0);
    const deductions = (items ?? []).filter((item) => item.item_type === "deduction").reduce((sum, item) => sum + Number(item.amount), 0);
    const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(`${value}T00:00:00+05:30`)) : "";
    const values: Record<string, string> = {
      generated_date: formatDate(new Date().toISOString().slice(0, 10)), company_name: auth.companyName,
      employee_name: employee.full_name, employee_code: employee.employee_code ?? "", designation: designation?.name ?? "Employee",
      date_of_joining: formatDate(employee.date_of_join), last_working_date: formatDate(exitCase.approved_last_working_date ?? exitCase.effective_date),
      case_number: exitCase.case_number, exit_reason: reasonResult.data?.name ?? "As recorded in the exit case",
      settlement_lines: (items ?? []).map((item) => `${item.label}: ${item.item_type === "deduction" ? "-" : "+"} INR ${Number(item.amount).toFixed(2)}`).join("\n") || "No settlement line items.",
      settlement_net: `INR ${(earnings - deductions).toFixed(2)}`, settlement_status: exitCase.settlement_status.replaceAll("_", " ")
    };
    const applicable = (templates ?? []).filter((template) => !(exitCase.scenario === "resignation" && template.document_type === "termination_letter") && !(exitCase.scenario === "termination" && template.document_type === "resignation_acceptance"));
    const latest = Array.from(new Map(applicable.map((item) => [item.document_type, item])).values());
    if (!latest.length) throw new Error("No active document templates are configured.");
    for (const template of latest) {
      const title = fillExitTemplate(template.title_template, values);
      const body = fillExitTemplate(template.body_template, values);
      const bytes = await createExitPdf({ title, body, companyName: auth.companyName, registeredAddress: policy?.registered_address, footerText: policy?.footer_text, signatoryName: policy?.signatory_name, signatoryTitle: policy?.signatory_title });
      const fileName = `${exitCase.case_number}-${template.document_type}.pdf`;
      const storagePath = `${auth.companyId}/${caseId}/${fileName}`;
      const uploaded = await db().storage.from("hr-exit-documents").upload(storagePath, bytes, { contentType: "application/pdf", upsert: true });
      if (uploaded.error) throw new Error(uploaded.error.message);
      const saved = await db().from("hr_exit_documents").upsert({ company_id: auth.companyId, case_id: caseId, template_id: template.id, document_type: template.document_type, file_name: fileName, storage_path: storagePath, template_version: template.version, status: "generated", generated_by: auth.userId, generated_at: new Date().toISOString() }, { onConflict: "case_id,document_type,template_version" });
      if (saved.error) throw new Error(saved.error.message);
    }
    await db().from("hr_exit_cases").update({ status: "documents_ready", current_stage: "documents" }).eq("id", caseId);
    await event({ companyId: auth.companyId, caseId, code: "DOCUMENTS_GENERATED", title: `${latest.length} exit documents generated`, actorId: auth.userId, actorName: auth.fullName });
    await sendExitNotification({ caseId, companyId: auth.companyId, event: "DOCUMENTS_GENERATED" });
    revalidatePath(`/exits/${caseId}`); revalidatePath("/exits"); redirect(target(caseId, "notice", `${latest.length} documents generated.`));
  } catch (error) { rethrowRedirect(error); redirect(target(caseId, "error", error instanceof Error ? error.message : "Unable to generate documents.")); }
}

export async function closeExitCase(formData: FormData) {
  const auth = await requireHrmsAuth("exit.manage");
  const caseId = text(formData.get("case_id"));
  try {
    const exitCase = await loadCase(auth.companyId, caseId);
    const { data: documents } = await db().from("hr_exit_documents").select("id").eq("case_id", caseId).neq("status", "void");
    if (exitCase.status !== "documents_ready" || !documents?.length) throw new Error("Generate the required documents before closing the case.");
    const now = new Date().toISOString();
    const result = await db().from("hr_exit_cases").update({ status: "closed", current_stage: "closed", closed_by: auth.userId, closed_at: now }).eq("company_id", auth.companyId).eq("id", caseId);
    if (result.error) throw new Error(result.error.message);
    await db().from("employees").update({ is_active: false, updated_at: now }).eq("company_id", auth.companyId).eq("id", exitCase.employee_id);
    await event({ companyId: auth.companyId, caseId, code: "CASE_CLOSED", title: "Exit case completed and employee deactivated", actorId: auth.userId, actorName: auth.fullName });
    await sendExitNotification({ caseId, companyId: auth.companyId, event: "CASE_CLOSED" });
    revalidatePath(`/exits/${caseId}`); revalidatePath("/exits"); revalidatePath("/people"); redirect(target(caseId, "notice", "Exit completed and employee marked inactive."));
  } catch (error) { rethrowRedirect(error); redirect(target(caseId, "error", error instanceof Error ? error.message : "Unable to close the case.")); }
}
