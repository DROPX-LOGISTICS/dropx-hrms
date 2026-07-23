"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { normalizePayrollCode } from "@/lib/payroll-formula";
import { supabaseAdmin } from "@/lib/supabase/admin";

const PAY_TYPES = ["employee_earning", "employee_deduction", "statutory_deduction", "statutory_contribution"] as const;

function db() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}
function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}
function fail(error: unknown): never {
  redirect(`/settings/payroll-heads?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save payroll head.")}`);
}
function finish(message: string): never {
  revalidatePath("/settings/payroll-heads");
  revalidatePath("/settings/salary");
  redirect(`/settings/payroll-heads?notice=${encodeURIComponent(message)}`);
}
async function audit(companyId: string, userId: string, entityId: string, action: string, afterData: unknown) {
  await db().from("hr_audit_log").insert({
    company_id: companyId,
    actor_user_id: userId,
    entity_type: "payroll_head",
    entity_id: entityId,
    action,
    after_data: afterData
  });
}
function readPayType(formData: FormData) {
  const payType = value(formData, "head_type");
  if (!PAY_TYPES.includes(payType as typeof PAY_TYPES[number])) throw new Error("Select a valid pay type.");
  return payType;
}

export async function createPayrollHead(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const name = value(formData, "name");
    const code = normalizePayrollCode(value(formData, "code"));
    const headType = readPayType(formData);
    if (name.length < 2 || name.length > 80) throw new Error("Payroll head name must contain 2–80 characters.");
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(code)) throw new Error("Use a payroll head code containing 2–40 letters, numbers or underscores.");
    if (code === "CTC") throw new Error("CTC is a protected system payroll head.");
    const orderResult = await db().from("hr_payroll_heads").select("display_order").eq("company_id", auth.companyId).order("display_order", { ascending: false }).limit(1).maybeSingle();
    if (orderResult.error) throw new Error(orderResult.error.message);
    const displayOrder = Math.min(Number(orderResult.data?.display_order ?? 90) + 10, 9999);
    const { data, error } = await db().from("hr_payroll_heads").insert({
      company_id: auth.companyId,
      code,
      name,
      head_type: headType,
      display_order: displayOrder,
      created_by: auth.userId
    }).select("id, code, name, head_type").single();
    if (error || !data) throw new Error(error?.message ?? "Unable to create payroll head.");
    await audit(auth.companyId, auth.userId, data.id, "insert", data);
  } catch (error) {
    fail(error);
  }
  finish("Payroll head created.");
}

export async function savePayrollHead(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(formData, "id");
    const name = value(formData, "name");
    const headType = readPayType(formData);
    if (!id || name.length < 2 || name.length > 80) throw new Error("Enter a valid payroll head name.");
    const { data, error } = await db().from("hr_payroll_heads").update({
      name,
      head_type: headType
    }).eq("company_id", auth.companyId).eq("id", id).eq("is_system", false).select("id, code, name, head_type").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("The CTC payroll head cannot be edited.");
    await audit(auth.companyId, auth.userId, id, "update", data);
  } catch (error) {
    fail(error);
  }
  finish("Payroll head updated.");
}

export async function togglePayrollHead(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  try {
    const id = value(formData, "id");
    const nextActive = value(formData, "next_active") === "true";
    const headResult = await db().from("hr_payroll_heads").select("id, code, is_system").eq("company_id", auth.companyId).eq("id", id).maybeSingle();
    if (headResult.error) throw new Error(headResult.error.message);
    if (!headResult.data || headResult.data.is_system) throw new Error("The CTC payroll head cannot be deactivated.");
    if (!nextActive) {
      const usage = await db().from("hr_salary_configuration_items").select("id", { count: "exact", head: true }).eq("company_id", auth.companyId).eq("payroll_head_id", id).eq("is_enabled", true);
      if (usage.error) throw new Error(usage.error.message);
      if ((usage.count ?? 0) > 0) throw new Error(`${headResult.data.code} is used by a salary configuration. Remove it there before deactivating this head.`);
    }
    const { error } = await db().from("hr_payroll_heads").update({ is_active: nextActive }).eq("company_id", auth.companyId).eq("id", id).eq("is_system", false);
    if (error) throw new Error(error.message);
    await audit(auth.companyId, auth.userId, id, nextActive ? "activate" : "deactivate", { is_active: nextActive });
  } catch (error) {
    fail(error);
  }
  finish("Payroll head status updated.");
}
