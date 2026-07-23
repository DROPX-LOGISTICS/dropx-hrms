"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

function database() {
  if (!supabaseAdmin) redirect("/settings/leave-policy?error=Database%20configuration%20is%20missing");
  return supabaseAdmin;
}

export async function saveLeavePolicy(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  const leaveMonth = Number(formData.get("leave_year_start_month"));
  if (!Number.isInteger(leaveMonth) || leaveMonth < 1 || leaveMonth > 12) redirect("/settings/leave-policy?error=Select%20a%20valid%20leave%20year%20start");
  const { error } = await database().from("hr_company_settings").upsert({
    company_id: auth.companyId,
    leave_year_start_month: leaveMonth,
    updated_by: auth.userId,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  if (error) redirect(`/settings/leave-policy?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings/leave-policy");
  redirect("/settings/leave-policy?notice=Leave%20policy%20saved");
}

export async function addLeaveType(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const allowance = Number(formData.get("annual_allowance"));
  if (name.length < 2 || !/^[A-Z0-9_]{2,20}$/.test(code) || !Number.isInteger(allowance) || allowance < 0 || allowance > 365) {
    redirect("/settings/leave-policy?error=Enter%20a%20valid%20leave%20type");
  }
  const { error } = await database().from("hr_leave_types").insert({
    company_id: auth.companyId,
    name,
    code,
    annual_allowance: allowance,
    color: String(formData.get("color") ?? "#1f7a50"),
    is_active: true,
    created_by: auth.userId
  });
  if (error) redirect(`/settings/leave-policy?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings/leave-policy");
  revalidatePath("/leave");
  redirect("/settings/leave-policy?notice=Leave%20type%20created");
}

export async function toggleLeaveType(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  const { error } = await database().from("hr_leave_types").update({
    is_active: String(formData.get("next_active")) === "true",
    updated_at: new Date().toISOString()
  }).eq("company_id", auth.companyId).eq("id", String(formData.get("leave_type_id") ?? ""));
  if (error) redirect(`/settings/leave-policy?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings/leave-policy");
  revalidatePath("/leave");
  redirect("/settings/leave-policy?notice=Leave%20type%20updated");
}
