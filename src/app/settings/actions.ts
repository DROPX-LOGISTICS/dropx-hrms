"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function saveCompanySettings(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  if (!supabaseAdmin) redirect("/settings?error=Database%20configuration%20is%20missing");
  const workWeek = formData.getAll("work_week").map(String).filter((day) => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(day));
  const grace = Number(formData.get("attendance_grace_minutes"));
  const fullDay = Number(formData.get("full_day_minutes"));
  const halfDay = Number(formData.get("half_day_minutes"));
  const leaveMonth = Number(formData.get("leave_year_start_month"));
  if (!workWeek.length || !Number.isInteger(grace) || grace < 0 || grace > 180 || !Number.isInteger(fullDay) || fullDay < 60 || !Number.isInteger(halfDay) || halfDay < 30 || !Number.isInteger(leaveMonth) || leaveMonth < 1 || leaveMonth > 12) redirect("/settings?error=Enter%20valid%20HR%20settings");
  const { error } = await supabaseAdmin.from("hr_company_settings").upsert({ company_id: auth.companyId, work_week: workWeek, attendance_grace_minutes: grace, full_day_minutes: fullDay, half_day_minutes: halfDay, leave_year_start_month: leaveMonth, updated_by: auth.userId, updated_at: new Date().toISOString() }, { onConflict: "company_id" });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings"); redirect("/settings?notice=HR%20settings%20saved");
}

export async function addLeaveType(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  if (!supabaseAdmin) redirect("/settings?error=Database%20configuration%20is%20missing");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const allowance = Number(formData.get("annual_allowance"));
  if (name.length < 2 || !/^[A-Z0-9_]{2,20}$/.test(code) || !Number.isInteger(allowance) || allowance < 0 || allowance > 365) redirect("/settings?error=Enter%20a%20valid%20leave%20type");
  const { error } = await supabaseAdmin.from("hr_leave_types").insert({ company_id: auth.companyId, name, code, annual_allowance: allowance, color: String(formData.get("color") ?? "#1f7a50"), is_active: true, created_by: auth.userId });
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings"); revalidatePath("/leave"); redirect("/settings?notice=Leave%20type%20created");
}

export async function toggleLeaveType(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  if (!supabaseAdmin) redirect("/settings?error=Database%20configuration%20is%20missing");
  const { error } = await supabaseAdmin.from("hr_leave_types").update({ is_active: String(formData.get("next_active")) === "true", updated_at: new Date().toISOString() }).eq("company_id", auth.companyId).eq("id", String(formData.get("leave_type_id") ?? ""));
  if (error) redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/settings"); revalidatePath("/leave"); redirect("/settings?notice=Leave%20type%20updated");
}
