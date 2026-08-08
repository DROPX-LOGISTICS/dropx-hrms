"use server";

import { revalidatePath } from "next/cache";
import { requireHrmsAuth } from "@/lib/auth";
import { actionError, actionSuccess, type ActionFeedbackState } from "@/lib/action-feedback";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseLeaveRequest } from "@/lib/validation";
export async function requestLeave(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("leave.request");
  if (!supabaseAdmin) return actionError("Database configuration is missing.");
  const parsed = parseLeaveRequest(formData);
  if (!parsed.ok) return actionError(parsed.error);
  const employeeId = String(formData.get("employee_id") ?? "");
  let employeeQuery = supabaseAdmin.from("employees").select("id").eq("company_id", auth.companyId).eq("id", employeeId);
  if (!auth.allLocations) employeeQuery = employeeQuery.in("location_id", auth.locationIds);
  const { data: employee } = await employeeQuery.maybeSingle();
  if (!employee) return actionError("Employee is outside your access.");
  const { error } = await supabaseAdmin.from("hr_leave_requests").insert({ company_id: auth.companyId, employee_id: employeeId, leave_type_id: parsed.value.leaveTypeId, start_date: parsed.value.startDate, end_date: parsed.value.endDate, reason: parsed.value.reason, requested_by: auth.userId });
  if (error) return actionError(error.message);
  revalidatePath("/");
  revalidatePath("/leave");
  revalidatePath("/approvals");
  return actionSuccess("Leave request submitted.");
}
