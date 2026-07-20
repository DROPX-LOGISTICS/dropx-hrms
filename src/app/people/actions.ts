"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseEmployeeForm } from "@/lib/validation";

export async function createEmployee(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) redirect(`/people?add=1&error=${encodeURIComponent(parsed.error)}`);
  if (!supabaseAdmin) redirect("/people?error=Database%20configuration%20is%20missing");
  const value = parsed.value;
  if (!auth.allLocations && !auth.locationIds.includes(value.locationId)) redirect("/people?error=Location%20access%20is%20not%20allowed");
  const { error } = await supabaseAdmin.from("employees").insert({
    company_id: auth.companyId,
    employee_code: value.employeeCode,
    biometric_id: value.biometricId,
    full_name: value.fullName,
    mobile_country_code: "91",
    mobile: value.mobile,
    email: value.email,
    date_of_join: value.dateOfJoin,
    location_id: value.locationId,
    designation_id: value.designationId,
    statutory_applicability: ["not_applicable"],
    profile_completion_status: "pending",
    is_active: true,
    created_by: auth.userId
  });
  if (error) redirect(`/people?add=1&error=${encodeURIComponent(error.message)}`);
  revalidatePath("/"); revalidatePath("/people");
  redirect("/people?notice=Employee%20created");
}

export async function setEmployeeActive(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  if (!supabaseAdmin) redirect("/people?error=Database%20configuration%20is%20missing");
  const employeeId = String(formData.get("employee_id") ?? "");
  const nextActive = String(formData.get("next_active")) === "true";
  let query = supabaseAdmin.from("employees").update({ is_active: nextActive, updated_at: new Date().toISOString() }).eq("company_id", auth.companyId).eq("id", employeeId);
  if (!auth.allLocations) query = query.in("location_id", auth.locationIds);
  const { error } = await query;
  if (error) redirect(`/people?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/"); revalidatePath("/people");
  redirect(`/people?notice=Employee%20${nextActive ? "activated" : "deactivated"}`);
}
