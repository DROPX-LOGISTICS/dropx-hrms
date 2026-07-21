"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

function db() { if (!supabaseAdmin) throw new Error("Database configuration is missing."); return supabaseAdmin; }
function value(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }
function optional(form: FormData, name: string) { return value(form, name) || null; }
function finish(message: string) { revalidatePath("/settings/exit"); revalidatePath("/exits"); redirect(`/settings/exit?notice=${encodeURIComponent(message)}`); }
function fail(error: unknown): never { redirect(`/settings/exit?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save master data.")}`); }
function code(form: FormData, name = "code") { const result = value(form, name).toUpperCase().replace(/[^A-Z0-9_]/g, "_"); if (!/^[A-Z0-9_]{2,40}$/.test(result)) throw new Error("Enter a valid master code."); return result; }

export async function saveExitPolicy(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const payload = {
      company_id: auth.companyId, case_number_prefix: code(form, "case_number_prefix").slice(0, 12),
      resignation_notice_days: Number(form.get("resignation_notice_days")), termination_notice_days: Number(form.get("termination_notice_days")),
      settlement_due_days: Number(form.get("settlement_due_days")), withdrawal_allowed: form.get("withdrawal_allowed") === "on",
      auto_create_tasks: form.get("auto_create_tasks") === "on", auto_generate_documents: form.get("auto_generate_documents") === "on",
      signatory_name: optional(form, "signatory_name"), signatory_title: optional(form, "signatory_title"), registered_address: optional(form, "registered_address"),
      footer_text: optional(form, "footer_text"), updated_by: auth.userId, updated_at: new Date().toISOString()
    };
    for (const amount of [payload.resignation_notice_days, payload.termination_notice_days, payload.settlement_due_days]) if (!Number.isInteger(amount) || amount < 0 || amount > 365) throw new Error("Policy day values must be whole numbers between 0 and 365.");
    const result = await db().from("hr_exit_policies").upsert(payload, { onConflict: "company_id" }); if (result.error) throw new Error(result.error.message);
  } catch (error) { fail(error); }
  finish("Exit policy saved.");
}

export async function saveExitReason(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "id"); const scenario = value(form, "scenario"); const name = value(form, "name");
    if (!["resignation","termination","other"].includes(scenario) || name.length < 2) throw new Error("Enter a valid scenario and reason name.");
    const payload = { company_id: auth.companyId, scenario, code: code(form), name, employee_selectable: form.get("employee_selectable") === "on", comment_required: form.get("comment_required") === "on", default_rehire_eligible: value(form, "default_rehire_eligible") === "unset" ? null : value(form, "default_rehire_eligible") === "true", display_order: Number(form.get("display_order") || 100), is_active: true, created_by: auth.userId };
    const result = id ? await db().from("hr_exit_reasons").update(payload).eq("company_id", auth.companyId).eq("id", id) : await db().from("hr_exit_reasons").insert(payload); if (result.error) throw new Error(result.error.message);
  } catch (error) { fail(error); }
  finish("Exit reason saved.");
}

export async function saveExitWorkflow(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "id"); const scenario = value(form, "scenario"); const approverRole = value(form, "approver_role"); const name = value(form, "name"); const stepOrder = Number(form.get("step_order"));
    if (!["resignation","termination","all"].includes(scenario) || !["REPORTING_MANAGER","HR_MANAGER","HRMS_ADMIN","OWNER"].includes(approverRole) || !Number.isInteger(stepOrder) || name.length < 2) throw new Error("Enter a valid workflow step.");
    const payload = { company_id: auth.companyId, scenario, code: code(form), name, step_order: stepOrder, approver_role: approverRole, is_required: form.get("is_required") === "on", is_active: true, created_by: auth.userId };
    const result = id ? await db().from("hr_exit_workflow_steps").update(payload).eq("company_id", auth.companyId).eq("id", id) : await db().from("hr_exit_workflow_steps").insert(payload); if (result.error) throw new Error(result.error.message);
  } catch (error) { fail(error); }
  finish("Approval workflow saved.");
}

export async function saveExitTaskTemplate(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "id"); const scenario = value(form, "scenario"); const category = value(form, "category"); const ownerRole = value(form, "owner_role"); const name = value(form, "name");
    if (!["resignation","termination","all"].includes(scenario) || !["handover","clearance","settlement","compliance"].includes(category) || !["EMPLOYEE","REPORTING_MANAGER","HR_MANAGER","HRMS_ADMIN","OWNER"].includes(ownerRole) || name.length < 2) throw new Error("Enter a valid task template.");
    const payload = { company_id: auth.companyId, scenario, category, code: code(form), name, instructions: optional(form, "instructions"), owner_role: ownerRole, due_offset_days: Number(form.get("due_offset_days") || 0), display_order: Number(form.get("display_order") || 100), is_required: form.get("is_required") === "on", is_active: true, created_by: auth.userId };
    if (!Number.isInteger(payload.due_offset_days) || payload.due_offset_days < -365 || payload.due_offset_days > 365) throw new Error("Task due offset must be between -365 and 365 days.");
    const result = id ? await db().from("hr_exit_task_templates").update(payload).eq("company_id", auth.companyId).eq("id", id) : await db().from("hr_exit_task_templates").insert(payload); if (result.error) throw new Error(result.error.message);
  } catch (error) { fail(error); }
  finish("Exit task template saved.");
}

export async function saveExitDocumentTemplate(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "id"); const name = value(form, "name"); const title = value(form, "title_template"); const body = value(form, "body_template"); const stage = value(form, "generation_stage");
    if (!id || name.length < 2 || !title || body.length < 20 || !["approval","completion"].includes(stage)) throw new Error("Complete the document template fields.");
    const result = await db().from("hr_exit_document_templates").update({ name, title_template: title, body_template: body, generation_stage: stage, is_active: form.get("is_active") === "on" }).eq("company_id", auth.companyId).eq("id", id); if (result.error) throw new Error(result.error.message);
  } catch (error) { fail(error); }
  finish("Document template saved.");
}

export async function saveExitNotificationTemplate(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "id"); const subject = value(form, "subject_template"); const body = value(form, "body_template");
    const emailList = (name: string) => value(form, name).split(/[;,\n]+/).map((email) => email.trim().toLowerCase()).filter(Boolean);
    if (!id || !subject || body.length < 10) throw new Error("Complete the notification subject and body.");
    const result = await db().from("hr_exit_notification_templates").update({ to_recipients: form.getAll("to_recipients").map(String), cc_recipients: form.getAll("cc_recipients").map(String), custom_to_emails: emailList("custom_to_emails"), custom_cc_emails: emailList("custom_cc_emails"), subject_template: subject, body_template: body, is_enabled: form.get("is_enabled") === "on" }).eq("company_id", auth.companyId).eq("id", id); if (result.error) throw new Error(result.error.message);
  } catch (error) { fail(error); }
  finish("Notification rule saved.");
}

export async function toggleExitMaster(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const tables: Record<string, string> = { reason: "hr_exit_reasons", workflow: "hr_exit_workflow_steps", task: "hr_exit_task_templates" };
    const table = tables[value(form, "master_type")]; if (!table) throw new Error("Invalid master type.");
    const result = await db().from(table).update({ is_active: value(form, "next_active") === "true" }).eq("company_id", auth.companyId).eq("id", value(form, "id")); if (result.error) throw new Error(result.error.message);
  } catch (error) { fail(error); }
  finish("Master status updated.");
}
