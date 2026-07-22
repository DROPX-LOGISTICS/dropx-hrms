"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { normalizePayrollCode, payrollFormulaReferences, validatePayrollConfiguration } from "@/lib/payroll-formula";
import { PayrollHeadRow } from "@/lib/payroll";
import { supabaseAdmin } from "@/lib/supabase/admin";

const HEAD_TYPES = ["earning", "deduction", "employer_contribution", "reimbursement"] as const;
function db() { if (!supabaseAdmin) throw new Error("Database configuration is missing."); return supabaseAdmin; }
function value(form: FormData, name: string) { return String(form.get(name) ?? "").trim(); }
function optional(form: FormData, name: string) { return value(form, name) || null; }
function payrollCode(form: FormData, name = "code") {
  const result = normalizePayrollCode(value(form, name));
  if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(result)) throw new Error("Use a pay head code containing 2–40 letters, numbers or underscores.");
  return result;
}
function finish(message: string): never {
  revalidatePath("/settings/salary");
  redirect(`/settings/salary?notice=${encodeURIComponent(message)}`);
}
function fail(error: unknown): never {
  redirect(`/settings/salary?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save payroll settings.")}`);
}
async function audit(companyId: string, userId: string, entityType: string, entityId: string, action: string, afterData: unknown) {
  await db().from("hr_audit_log").insert({ company_id: companyId, actor_user_id: userId, entity_type: entityType, entity_id: entityId, action, after_data: afterData });
}

export async function createPayrollHead(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const name = value(form, "name"); const code = payrollCode(form); const headType = value(form, "head_type"); const displayOrder = Number(form.get("display_order") || 100);
    if (name.length < 2 || name.length > 80 || !HEAD_TYPES.includes(headType as typeof HEAD_TYPES[number])) throw new Error("Enter a valid pay head name and type.");
    if (["CTC", "BASIC_SALARY"].includes(code)) throw new Error("CTC and Basic Salary are protected system heads.");
    if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 9999) throw new Error("Display order must be between 0 and 9999.");
    const { data: head, error } = await db().from("hr_payroll_heads").insert({ company_id: auth.companyId, code, name, head_type: headType, display_order: displayOrder, created_by: auth.userId }).select("id, code, name, head_type").single();
    if (error || !head) throw new Error(error?.message ?? "Unable to create pay head.");
    const configurations = await db().from("hr_salary_configurations").select("id").eq("company_id", auth.companyId);
    if (configurations.error) throw new Error(configurations.error.message);
    if (configurations.data?.length) {
      const items = configurations.data.map((configuration) => ({ company_id: auth.companyId, configuration_id: configuration.id, payroll_head_id: head.id, calculation_type: "formula", formula: "0", is_enabled: true, display_order: displayOrder }));
      const itemResult = await db().from("hr_salary_configuration_items").insert(items);
      if (itemResult.error) throw new Error(itemResult.error.message);
    }
    await audit(auth.companyId, auth.userId, "payroll_head", head.id, "insert", head);
  } catch (error) { fail(error); }
  finish("Payroll head created and added to salary configurations.");
}

export async function savePayrollHead(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "id"); const name = value(form, "name"); const headType = value(form, "head_type"); const displayOrder = Number(form.get("display_order"));
    if (!id || name.length < 2 || name.length > 80 || !HEAD_TYPES.includes(headType as typeof HEAD_TYPES[number]) || !Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 9999) throw new Error("Enter valid custom pay head details.");
    const { data, error } = await db().from("hr_payroll_heads").update({ name, head_type: headType, display_order: displayOrder }).eq("company_id", auth.companyId).eq("id", id).eq("is_system", false).select("id, code, name, head_type, display_order").maybeSingle();
    if (error) throw new Error(error.message); if (!data) throw new Error("System pay heads cannot be edited.");
    await audit(auth.companyId, auth.userId, "payroll_head", id, "update", data);
  } catch (error) { fail(error); }
  finish("Payroll head updated.");
}

export async function togglePayrollHead(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "id"); const nextActive = value(form, "next_active") === "true";
    const headResult = await db().from("hr_payroll_heads").select("id, code, display_order, is_system").eq("company_id", auth.companyId).eq("id", id).maybeSingle();
    if (headResult.error) throw new Error(headResult.error.message); if (!headResult.data || headResult.data.is_system) throw new Error("System pay heads cannot be deactivated.");
    if (!nextActive) {
      const formulas = await db().from("hr_salary_configuration_items").select("formula, hr_payroll_heads!inner(code)").eq("company_id", auth.companyId).eq("calculation_type", "formula").neq("payroll_head_id", id);
      if (formulas.error) throw new Error(formulas.error.message);
      const used = (formulas.data ?? []).some((item) => item.formula && payrollFormulaReferences(item.formula).includes(headResult.data!.code));
      if (used) throw new Error(`${headResult.data.code} is referenced by another equation. Remove that reference before deactivating it.`);
    }
    const updateResult = await db().from("hr_payroll_heads").update({ is_active: nextActive }).eq("company_id", auth.companyId).eq("id", id).eq("is_system", false);
    if (updateResult.error) throw new Error(updateResult.error.message);
    if (nextActive) {
      const configurations = await db().from("hr_salary_configurations").select("id").eq("company_id", auth.companyId);
      if (configurations.error) throw new Error(configurations.error.message);
      const rows = (configurations.data ?? []).map((configuration) => ({ company_id: auth.companyId, configuration_id: configuration.id, payroll_head_id: id, calculation_type: "formula", formula: "0", is_enabled: true, display_order: headResult.data!.display_order }));
      if (rows.length) { const result = await db().from("hr_salary_configuration_items").upsert(rows, { onConflict: "configuration_id,payroll_head_id", ignoreDuplicates: true }); if (result.error) throw new Error(result.error.message); }
    } else {
      const result = await db().from("hr_salary_configuration_items").update({ is_enabled: false }).eq("company_id", auth.companyId).eq("payroll_head_id", id); if (result.error) throw new Error(result.error.message);
    }
    await audit(auth.companyId, auth.userId, "payroll_head", id, nextActive ? "activate" : "deactivate", { is_active: nextActive });
  } catch (error) { fail(error); }
  finish("Payroll head status updated.");
}

export async function createSalaryConfiguration(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const name = value(form, "name"); const code = payrollCode(form); const effectiveFrom = value(form, "effective_from");
    if (name.length < 2 || name.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) throw new Error("Enter a valid configuration name and effective date.");
    const { data: configuration, error } = await db().from("hr_salary_configurations").insert({ company_id: auth.companyId, code, name, description: optional(form, "description"), effective_from: effectiveFrom, is_default: false, created_by: auth.userId }).select("id, code, name").single();
    if (error || !configuration) throw new Error(error?.message ?? "Unable to create salary configuration.");
    const headsResult = await db().from("hr_payroll_heads").select("id, code, display_order").eq("company_id", auth.companyId).eq("is_active", true).order("display_order");
    if (headsResult.error) throw new Error(headsResult.error.message);
    const items = (headsResult.data ?? []).map((head) => ({ company_id: auth.companyId, configuration_id: configuration.id, payroll_head_id: head.id, calculation_type: head.code === "CTC" ? "input" : "formula", formula: head.code === "CTC" ? null : head.code === "BASIC_SALARY" ? "CTC * 50%" : "0", is_enabled: true, display_order: head.display_order }));
    if (items.length) { const itemResult = await db().from("hr_salary_configuration_items").insert(items); if (itemResult.error) throw new Error(itemResult.error.message); }
    await audit(auth.companyId, auth.userId, "salary_configuration", configuration.id, "insert", configuration);
  } catch (error) { fail(error); }
  finish("Salary configuration created.");
}

export async function saveSalaryConfiguration(form: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(form, "configuration_id"); const name = value(form, "name"); const description = optional(form, "description"); const effectiveFrom = value(form, "effective_from"); const effectiveTo = optional(form, "effective_to"); const annualisationFactor = Number(form.get("annualisation_factor") || 12); const isDefault = form.get("is_default") === "on"; const isActive = form.get("is_active") === "on";
    if (!id || name.length < 2 || name.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || (effectiveTo && (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo) || effectiveTo < effectiveFrom)) || !Number.isInteger(annualisationFactor) || annualisationFactor < 1 || annualisationFactor > 365) throw new Error("Complete the salary configuration details correctly.");
    if (isDefault && !isActive) throw new Error("The default salary configuration must remain active.");
    const headsResult = await db().from("hr_payroll_heads").select("id, code, name, head_type, is_system, display_order, is_active").eq("company_id", auth.companyId).eq("is_active", true).order("display_order");
    if (headsResult.error) throw new Error(headsResult.error.message);
    const heads = (headsResult.data ?? []) as PayrollHeadRow[];
    const lines = heads.map((head) => {
      if (head.code === "CTC") return { code: head.code, calculationType: "input" as const };
      const calculationType: "fixed" | "formula" = head.code === "BASIC_SALARY" ? "formula" : value(form, `calculation_type:${head.id}`) === "fixed" ? "fixed" : "formula";
      return { code: head.code, calculationType, formula: calculationType === "formula" ? value(form, `formula:${head.id}`) : null, fixedAmount: calculationType === "fixed" ? Number(form.get(`fixed_amount:${head.id}`)) : null };
    });
    validatePayrollConfiguration(lines);
    const configurationCheck = await db().from("hr_salary_configurations").select("id, is_default").eq("company_id", auth.companyId).eq("id", id).maybeSingle();
    if (configurationCheck.error) throw new Error(configurationCheck.error.message); if (!configurationCheck.data) throw new Error("Salary configuration was not found.");
    if (configurationCheck.data.is_default && !isDefault) throw new Error("Select another default configuration before removing the current default.");
    if (isDefault) { const reset = await db().from("hr_salary_configurations").update({ is_default: false }).eq("company_id", auth.companyId).neq("id", id); if (reset.error) throw new Error(reset.error.message); }
    const configurationResult = await db().from("hr_salary_configurations").update({ name, description, effective_from: effectiveFrom, effective_to: effectiveTo, annualisation_factor: annualisationFactor, is_default: isDefault, is_active: isActive, updated_at: new Date().toISOString() }).eq("company_id", auth.companyId).eq("id", id);
    if (configurationResult.error) throw new Error(configurationResult.error.message);
    const items = heads.map((head, index) => {
      const line = lines[index]; const enabled = head.is_system || form.get(`enabled:${head.id}`) === "on";
      return { company_id: auth.companyId, configuration_id: id, payroll_head_id: head.id, calculation_type: line.calculationType, formula: line.calculationType === "formula" ? line.formula : null, fixed_amount: line.calculationType === "fixed" ? line.fixedAmount : null, is_enabled: enabled, display_order: head.display_order };
    });
    const itemResult = await db().from("hr_salary_configuration_items").upsert(items, { onConflict: "configuration_id,payroll_head_id" });
    if (itemResult.error) throw new Error(itemResult.error.message);
    await audit(auth.companyId, auth.userId, "salary_configuration", id, "update", { name, effective_from: effectiveFrom, effective_to: effectiveTo, annualisation_factor: annualisationFactor, is_default: isDefault, is_active: isActive, items });
  } catch (error) { fail(error); }
  finish("Salary configuration and pay head equations saved.");
}
