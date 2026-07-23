"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { parsePayrollValueExpression, validatePayrollValueRange } from "@/lib/payroll-configuration";
import { normalizePayrollCode, validatePayrollConfiguration } from "@/lib/payroll-formula";
import { PayrollHeadRow } from "@/lib/payroll";
import { supabaseAdmin } from "@/lib/supabase/admin";

function db() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}
function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}
function fail(error: unknown): never {
  redirect(`/settings/salary?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save salary configuration.")}`);
}
function finish(message: string): never {
  revalidatePath("/settings/salary");
  redirect(`/settings/salary?notice=${encodeURIComponent(message)}`);
}
async function audit(companyId: string, userId: string, entityId: string, action: string, afterData: unknown) {
  await db().from("hr_audit_log").insert({
    company_id: companyId,
    actor_user_id: userId,
    entity_type: "salary_configuration",
    entity_id: entityId,
    action,
    after_data: afterData
  });
}

export async function createSalaryConfiguration(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const name = value(formData, "name");
    const code = normalizePayrollCode(value(formData, "code"));
    if (name.length < 2 || name.length > 80) throw new Error("Configuration name must contain 2–80 characters.");
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) throw new Error("Use a configuration code containing 2–40 letters, numbers or underscores.");
    const { data: configuration, error } = await db().from("hr_salary_configurations").insert({
      company_id: auth.companyId,
      code,
      name,
      is_default: false,
      is_active: true,
      created_by: auth.userId
    }).select("id, code, name").single();
    if (error || !configuration) throw new Error(error?.message ?? "Unable to create salary configuration.");

    const ctcResult = await db().from("hr_payroll_heads").select("id, display_order").eq("company_id", auth.companyId).eq("code", "CTC").eq("is_active", true).maybeSingle();
    if (ctcResult.error || !ctcResult.data) throw new Error(ctcResult.error?.message ?? "CTC payroll head is missing.");
    const itemResult = await db().from("hr_salary_configuration_items").insert({
      company_id: auth.companyId,
      configuration_id: configuration.id,
      payroll_head_id: ctcResult.data.id,
      calculation_type: "input",
      formula: null,
      fixed_amount: null,
      value_expression: null,
      minimum_value: null,
      maximum_value: null,
      is_enabled: true,
      display_order: 10
    });
    if (itemResult.error) throw new Error(itemResult.error.message);
    await audit(auth.companyId, auth.userId, configuration.id, "insert", configuration);
  } catch (error) {
    fail(error);
  }
  finish("Salary configuration created. Add the required payroll heads below.");
}

export async function saveSalaryConfiguration(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const configurationId = value(formData, "configuration_id");
    const payrollHeadIds = formData.getAll("payroll_head_id").map((item) => String(item).trim());
    const valueExpressions = formData.getAll("value_expression").map((item) => String(item));
    const minimumValues = formData.getAll("minimum_value").map((item) => String(item));
    const maximumValues = formData.getAll("maximum_value").map((item) => String(item));
    if (!configurationId) throw new Error("Salary configuration was not found.");
    if (!payrollHeadIds.length || payrollHeadIds.some((id) => !id)) throw new Error("Select a payroll head for every row.");
    if (new Set(payrollHeadIds).size !== payrollHeadIds.length) throw new Error("A payroll head can be added only once in a salary configuration.");
    if ([valueExpressions, minimumValues, maximumValues].some((items) => items.length !== payrollHeadIds.length)) throw new Error("Salary configuration rows are incomplete.");

    const configurationResult = await db().from("hr_salary_configurations").select("id, code, name").eq("company_id", auth.companyId).eq("id", configurationId).maybeSingle();
    if (configurationResult.error) throw new Error(configurationResult.error.message);
    if (!configurationResult.data) throw new Error("Salary configuration was not found.");

    const headsResult = await db().from("hr_payroll_heads").select("id, code, name, head_type, is_system, display_order, is_active").eq("company_id", auth.companyId).in("id", payrollHeadIds);
    if (headsResult.error) throw new Error(headsResult.error.message);
    const heads = (headsResult.data ?? []) as PayrollHeadRow[];
    if (heads.length !== payrollHeadIds.length) throw new Error("One or more payroll heads do not belong to your company.");
    const headById = new Map(heads.map((head) => [head.id, head]));

    const definitions = payrollHeadIds.map((headId, index) => {
      const head = headById.get(headId);
      if (!head || (!head.is_active && !head.is_system)) throw new Error(`${head?.name ?? "Payroll head"} is inactive.`);
      const definition = parsePayrollValueExpression(valueExpressions[index]);
      const range = validatePayrollValueRange(minimumValues[index], maximumValues[index], definition);
      return { head, definition, ...range };
    });
    validatePayrollConfiguration(definitions.map(({ head, definition }) => ({
      code: head.code,
      calculationType: definition.calculationType,
      formula: definition.formula,
      fixedAmount: definition.fixedAmount
    })));

    const rows = definitions.map(({ head, definition, minimumValue, maximumValue }, index) => ({
      company_id: auth.companyId,
      configuration_id: configurationId,
      payroll_head_id: head.id,
      calculation_type: definition.calculationType,
      formula: definition.formula,
      fixed_amount: definition.fixedAmount,
      value_expression: definition.valueExpression,
      minimum_value: minimumValue,
      maximum_value: maximumValue,
      is_enabled: true,
      display_order: (index + 1) * 10
    }));
    const upsertResult = await db().from("hr_salary_configuration_items").upsert(rows, { onConflict: "configuration_id,payroll_head_id" });
    if (upsertResult.error) throw new Error(upsertResult.error.message);

    const existingResult = await db().from("hr_salary_configuration_items").select("id, payroll_head_id").eq("company_id", auth.companyId).eq("configuration_id", configurationId);
    if (existingResult.error) throw new Error(existingResult.error.message);
    const selected = new Set(payrollHeadIds);
    const staleIds = (existingResult.data ?? []).filter((item) => !selected.has(item.payroll_head_id)).map((item) => item.id);
    if (staleIds.length) {
      const deleteResult = await db().from("hr_salary_configuration_items").delete().eq("company_id", auth.companyId).eq("configuration_id", configurationId).in("id", staleIds);
      if (deleteResult.error) throw new Error(deleteResult.error.message);
    }
    await audit(auth.companyId, auth.userId, configurationId, "update", { ...configurationResult.data, items: rows });
  } catch (error) {
    fail(error);
  }
  finish("Salary configuration saved.");
}
