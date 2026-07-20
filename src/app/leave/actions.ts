"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseLeaveRequest } from "@/lib/validation";

export async function requestLeave(formData: FormData) {
  const auth = await requireHrmsAuth("leave.request");
  if (!supabaseAdmin) redirect("/leave?error=Database%20configuration%20is%20missing");
  const parsed = parseLeaveRequest(formData);
  if (!parsed.ok) redirect(`/leave?request=1&error=${encodeURIComponent(parsed.error)}`);
  const employeeId = String(formData.get("employee_id") ?? "");
  let employeeQuery = supabaseAdmin.from("employees").select("id").eq("company_id", auth.companyId).eq("id", employeeId);
  if (!auth.allLocations) employeeQuery = employeeQuery.in("location_id", auth.locationIds);
  const { data: employee } = await employeeQuery.maybeSingle();
  if (!employee) redirect("/leave?request=1&error=Employee%20is%20outside%20your%20access");
  const { error } = await supabaseAdmin.from("hr_leave_requests").insert({ company_id: auth.companyId, employee_id: employeeId, leave_type_id: parsed.value.leaveTypeId, start_date: parsed.value.startDate, end_date: parsed.value.endDate, reason: parsed.value.reason, requested_by: auth.userId });
  if (error) redirect(`/leave?request=1&error=${encodeURIComponent(error.message)}`);
  revalidatePath("/"); revalidatePath("/leave"); revalidatePath("/approvals");
  redirect("/leave?notice=Leave%20request%20submitted");
}
