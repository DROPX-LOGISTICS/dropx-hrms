"use server";

import { revalidatePath } from "next/cache";
import { requireHrmsAuth } from "@/lib/auth";
import {
  parsePayrollValueExpression,
  payrollValueMethodState,
  validatePayrollValueRange
} from "@/lib/payroll-configuration";
import type { PayrollValueMethod } from "@/lib/payroll-configuration";
import { PACKAGE_TYPE_LABELS, PACKAGE_TYPES } from "@/lib/package-types";
import { normalizePayrollCode, validatePayrollConfiguration } from "@/lib/payroll-formula";
import type { PayrollHeadRow } from "@/lib/payroll";
import { savePackageRateDefaults } from "@/lib/payroll-run";
import { actionError, actionSuccess, type ActionFeedbackState } from "@/lib/action-feedback";
import { supabaseAdmin } from "@/lib/supabase/admin";

const VALUE_METHODS: PayrollValueMethod[] = ["input", "fixed", "percentage", "advanced"];
const PAYROLL_TYPE_LABELS: Record<PayrollHeadRow["head_type"], string> = {
  ctc: "CTC",
  employee_earning: "Employee Earnings",
  employee_deduction: "Employee Deductions",
  statutory_contribution: "Statutory Contributions",
  statutory_deduction: "Statutory Deductions"
};

function db() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function values(formData: FormData, name: string) {
  return formData.getAll(name).map((item) => String(item).trim());
}

function fail(error: unknown): ActionFeedbackState {
  const message = error instanceof Error ? error.message : "Unable to save salary configuration.";
  if (message.includes("hr_salary_configurations_company_id_code_key") || /duplicate key.*\bcode\b/i.test(message)) {
    return actionError("A salary configuration with this code already exists. Choose a different configuration code.");
  }
  return actionError(message);
}

async function assertUniqueConfigurationCode(companyId: string, code: string) {
  const existing = await db()
    .from("hr_salary_configurations")
    .select("id")
    .eq("company_id", companyId)
    .eq("code", code)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) throw new Error("A salary configuration with this code already exists. Choose a different configuration code.");
}

function finish(message: string): ActionFeedbackState {
  revalidatePath("/settings/salary");
  return actionSuccess(message);
}

async function audit(companyId: string, userId: string, entityId: string, action: string, afterData: unknown) {
  const result = await db().from("hr_audit_log").insert({
    company_id: companyId,
    actor_user_id: userId,
    entity_type: "salary_configuration",
    entity_id: entityId,
    action,
    after_data: afterData
  });
  if (result.error) {
    console.error("Salary configuration audit log failed:", result.error.message);
  }
}

async function buildSalaryRows(companyId: string, formData: FormData) {
  const payrollHeadIds = values(formData, "payroll_head_id");
  const payrollHeadTypes = values(formData, "payroll_head_type");
  const methods = values(formData, "value_method");
  const valueExpressions = values(formData, "value_expression");
  const minimumValues = values(formData, "minimum_value");
  const maximumValues = values(formData, "maximum_value");

  if (!payrollHeadIds.length || payrollHeadIds.some((id) => !id)) throw new Error("Select a payroll component for every row.");
  if (new Set(payrollHeadIds).size !== payrollHeadIds.length) throw new Error("A payroll component can be added only once.");
  if ([payrollHeadTypes, methods, valueExpressions, minimumValues, maximumValues].some((items) => items.length !== payrollHeadIds.length)) {
    throw new Error("One or more salary component rows are incomplete.");
  }

  const headsResult = await db()
    .from("hr_payroll_heads")
    .select("id, code, name, head_type, is_system, display_order, is_active")
    .eq("company_id", companyId)
    .in("id", payrollHeadIds);
  if (headsResult.error) throw new Error(headsResult.error.message);

  const heads = (headsResult.data ?? []) as PayrollHeadRow[];
  if (heads.length !== payrollHeadIds.length) throw new Error("One or more payroll components do not belong to your company.");
  const headById = new Map(heads.map((head) => [head.id, head]));

  const definitions = payrollHeadIds.map((headId, index) => {
    const head = headById.get(headId);
    if (!head || (!head.is_active && !head.is_system)) throw new Error(`${head?.name ?? "Payroll component"} is inactive.`);
    if (payrollHeadTypes[index] !== head.head_type) {
      throw new Error(`${head.name} must remain under ${PAYROLL_TYPE_LABELS[head.head_type]}.`);
    }

    const method = methods[index] as PayrollValueMethod;
    if (!VALUE_METHODS.includes(method)) throw new Error(`Choose a valid calculation method for ${head.name}.`);

    const expression = valueExpressions[index];
    if (head.code === "CTC") {
      if (method !== "input") throw new Error("CTC must remain an employee-specific input.");
      if (expression || minimumValues[index] || maximumValues[index]) {
        throw new Error("CTC does not use a formula, minimum value or maximum value.");
      }
    }

    const definition = parsePayrollValueExpression(expression);
    if (method === "input" && definition.calculationType !== "input") {
      throw new Error(`${head.name} must be left blank when using employee-specific input.`);
    }
    if (method === "fixed" && definition.calculationType !== "fixed") {
      throw new Error(`Enter a fixed amount for ${head.name}.`);
    }
    if (method === "percentage" && payrollValueMethodState(expression).method !== "percentage") {
      throw new Error(`Choose a percentage and base component for ${head.name}.`);
    }
    if (method === "advanced" && definition.calculationType !== "formula") {
      throw new Error(`Enter an equation for ${head.name}.`);
    }

    const range = head.code === "CTC"
      ? { minimumValue: null, maximumValue: null }
      : validatePayrollValueRange(minimumValues[index], maximumValues[index], definition);
    return { head, definition, ...range };
  });

  validatePayrollConfiguration(definitions.map(({ head, definition }) => ({
    code: head.code,
    calculationType: definition.calculationType,
    formula: definition.formula,
    fixedAmount: definition.fixedAmount
  })));

  return definitions.map(({ head, definition, minimumValue, maximumValue }, index) => ({
    company_id: companyId,
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
}

export async function createSalaryConfiguration(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");
  let createdConfigurationId = "";

  try {
    const name = value(formData, "name");
    const code = normalizePayrollCode(value(formData, "code"));
    if (name.length < 2 || name.length > 80) throw new Error("Configuration name must contain 2–80 characters.");
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) throw new Error("Use a configuration code containing 2–40 letters, numbers or underscores.");

    await assertUniqueConfigurationCode(auth.companyId, code);
    const salaryRows = await buildSalaryRows(auth.companyId, formData);
    const configurationResult = await db().from("hr_salary_configurations").insert({
      company_id: auth.companyId,
      code,
      name,
      is_default: false,
      is_active: true,
      created_by: auth.userId
    }).select("id, code, name").single();
    if (configurationResult.error || !configurationResult.data) {
      throw new Error(configurationResult.error?.message ?? "Unable to create salary configuration.");
    }

    createdConfigurationId = configurationResult.data.id;
    const rows = salaryRows.map((row) => ({ ...row, configuration_id: createdConfigurationId }));
    const itemResult = await db().from("hr_salary_configuration_items").insert(rows);
    if (itemResult.error) throw new Error(itemResult.error.message);

    await audit(auth.companyId, auth.userId, createdConfigurationId, "insert", {
      ...configurationResult.data,
      items: rows
    });
  } catch (error) {
    if (createdConfigurationId) {
      await db()
        .from("hr_salary_configurations")
        .delete()
        .eq("company_id", auth.companyId)
        .eq("id", createdConfigurationId);
    }
    return fail(error);
  }

  return finish("Salary configuration created and saved.");
}

export async function saveSalaryConfiguration(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");

  try {
    const configurationId = value(formData, "configuration_id");
    if (!configurationId) throw new Error("Salary configuration was not found.");

    const configurationResult = await db()
      .from("hr_salary_configurations")
      .select("id, code, name")
      .eq("company_id", auth.companyId)
      .eq("id", configurationId)
      .maybeSingle();
    if (configurationResult.error) throw new Error(configurationResult.error.message);
    if (!configurationResult.data) throw new Error("Salary configuration was not found.");
    const configurationName = value(formData, "configuration_name") || configurationResult.data.name;
    if (configurationName.length < 2 || configurationName.length > 80) {
      throw new Error("Configuration name must contain 2–80 characters.");
    }

    const salaryRows = await buildSalaryRows(auth.companyId, formData);
    const rows = salaryRows.map((row) => ({ ...row, configuration_id: configurationId }));
    const upsertResult = await db()
      .from("hr_salary_configuration_items")
      .upsert(rows, { onConflict: "configuration_id,payroll_head_id" });
    if (upsertResult.error) throw new Error(upsertResult.error.message);

    const existingResult = await db()
      .from("hr_salary_configuration_items")
      .select("id, payroll_head_id")
      .eq("company_id", auth.companyId)
      .eq("configuration_id", configurationId);
    if (existingResult.error) throw new Error(existingResult.error.message);

    const selected = new Set(salaryRows.map((row) => row.payroll_head_id));
    const staleIds = (existingResult.data ?? [])
      .filter((item) => !selected.has(item.payroll_head_id))
      .map((item) => item.id);
    if (staleIds.length) {
      const deleteResult = await db()
        .from("hr_salary_configuration_items")
        .delete()
        .eq("company_id", auth.companyId)
        .eq("configuration_id", configurationId)
        .in("id", staleIds);
      if (deleteResult.error) throw new Error(deleteResult.error.message);
    }

    if (configurationName !== configurationResult.data.name) {
      const updateResult = await db()
        .from("hr_salary_configurations")
        .update({ name: configurationName })
        .eq("company_id", auth.companyId)
        .eq("id", configurationId);
      if (updateResult.error) throw new Error(updateResult.error.message);
    }

    await audit(auth.companyId, auth.userId, configurationId, "update", {
      ...configurationResult.data,
      name: configurationName,
      items: rows
    });
  } catch (error) {
    return fail(error);
  }

  return finish("Salary configuration saved.");
}

export async function deleteSalaryConfiguration(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");

  try {
    const configurationId = value(formData, "configuration_id");
    if (!configurationId) throw new Error("Salary configuration was not found.");

    const configurationResult = await db()
      .from("hr_salary_configurations")
      .select("id, code, name, is_default")
      .eq("company_id", auth.companyId)
      .eq("id", configurationId)
      .maybeSingle();
    if (configurationResult.error) throw new Error(configurationResult.error.message);
    if (!configurationResult.data) throw new Error("Salary configuration was not found.");

    if (configurationResult.data.is_default) {
      throw new Error("The default salary configuration cannot be deleted.");
    }

    const usage = await db()
      .from("hr_employee_salary_assignments")
      .select("id", { count: "exact", head: true })
      .eq("company_id", auth.companyId)
      .eq("configuration_id", configurationId);
    if (usage.error) throw new Error(usage.error.message);
    if ((usage.count ?? 0) > 0) {
      throw new Error("This configuration is assigned to one or more employees. Reassign them before deleting.");
    }

    const deleteResult = await db()
      .from("hr_salary_configurations")
      .delete()
      .eq("company_id", auth.companyId)
      .eq("id", configurationId);
    if (deleteResult.error) throw new Error(deleteResult.error.message);

    await audit(auth.companyId, auth.userId, configurationId, "delete", configurationResult.data);
  } catch (error) {
    return fail(error);
  }

  return finish("Salary configuration deleted.");
}

export async function savePackageRateDefaultsAction(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  try {
    const auth = await requireHrmsAuth("settings.manage");
    const rates = PACKAGE_TYPES.map((packageType) => {
      const rate = Number(formData.get(`rate_${packageType}`) ?? 0);
      if (!Number.isFinite(rate) || rate < 0) throw new Error(`Enter a valid rate for ${PACKAGE_TYPE_LABELS[packageType]}.`);
      return { packageType, rate };
    });
    await savePackageRateDefaults(auth, rates);
    revalidatePath("/settings/salary");
    revalidatePath("/payroll");
    return actionSuccess("Package rate defaults saved.");
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "Unable to save package rate defaults.");
  }
}
