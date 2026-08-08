"use server";

import { revalidatePath } from "next/cache";
import { requireHrmsAuth } from "@/lib/auth";
import { actionError, actionSuccess, type ActionFeedbackState } from "@/lib/action-feedback";
import { supabaseAdmin } from "@/lib/supabase/admin";

function database() {
  if (!supabaseAdmin) return null;
  return supabaseAdmin;
}

export async function saveLeavePolicy(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");
  const db = database();
  if (!db) return actionError("Database configuration is missing.");
  const leaveMonth = Number(formData.get("leave_year_start_month"));
  if (!Number.isInteger(leaveMonth) || leaveMonth < 1 || leaveMonth > 12) return actionError("Select a valid leave year start");
  const { error } = await db.from("hr_company_settings").upsert({
    company_id: auth.companyId,
    leave_year_start_month: leaveMonth,
    updated_by: auth.userId,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  if (error) return actionError(error.message);
  revalidatePath("/settings/leave-policy");
  return actionSuccess("Leave policy saved.");
}

export async function addLeaveType(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");
  const db = database();
  if (!db) return actionError("Database configuration is missing.");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const allowance = Number(formData.get("annual_allowance"));
  if (name.length < 2 || !/^[A-Z0-9_]{2,20}$/.test(code) || !Number.isInteger(allowance) || allowance < 0 || allowance > 365) {
    return actionError("Enter a valid leave type");
  }
  const { error } = await db.from("hr_leave_types").insert({
    company_id: auth.companyId,
    name,
    code,
    annual_allowance: allowance,
    color: String(formData.get("color") ?? "#1f7a50"),
    is_active: true,
    created_by: auth.userId
  });
  if (error) return actionError(error.message);
  revalidatePath("/settings/leave-policy");
  revalidatePath("/leave");
  return actionSuccess("Leave type created.");
}

export async function toggleLeaveType(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");
  const db = database();
  if (!db) return actionError("Database configuration is missing.");
  const { error } = await db.from("hr_leave_types").update({
    is_active: String(formData.get("next_active")) === "true",
    updated_at: new Date().toISOString()
  }).eq("company_id", auth.companyId).eq("id", String(formData.get("leave_type_id") ?? ""));
  if (error) return actionError(error.message);
  revalidatePath("/settings/leave-policy");
  revalidatePath("/leave");
  return actionSuccess("Leave type updated.");
}
