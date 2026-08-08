"use server";

import { revalidatePath } from "next/cache";
import { requireHrmsAuth } from "@/lib/auth";
import { actionError, actionSuccess, type ActionFeedbackState } from "@/lib/action-feedback";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function saveAttendanceSettings(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");
  if (!supabaseAdmin) return actionError("Database configuration is missing.");
  const workWeek = formData.getAll("work_week").map(String).filter((day) => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(day));
  const grace = Number(formData.get("attendance_grace_minutes"));
  const fullDay = Number(formData.get("full_day_minutes"));
  const halfDay = Number(formData.get("half_day_minutes"));
  if (!workWeek.length || !Number.isInteger(grace) || grace < 0 || grace > 180 || !Number.isInteger(fullDay) || fullDay < 60 || !Number.isInteger(halfDay) || halfDay < 30) {
    return actionError("Enter valid attendance settings");
  }
  const { error } = await supabaseAdmin.from("hr_company_settings").upsert({
    company_id: auth.companyId,
    work_week: workWeek,
    attendance_grace_minutes: grace,
    full_day_minutes: fullDay,
    half_day_minutes: halfDay,
    updated_by: auth.userId,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  if (error) return actionError(error.message);
  revalidatePath("/settings");
  revalidatePath("/settings/attendance-policy");
  return actionSuccess("Attendance policy saved.");
}
