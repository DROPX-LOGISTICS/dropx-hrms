"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseEmployeeForm } from "@/lib/validation";
import { generateBiometricEnrolmentId, syncEmployeeBiometricEnrolment } from "@/lib/biometric";
import { employeeDesignationsForLocation, isEmployeeDesignation } from "@/lib/employee-options";

export async function createEmployee(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) redirect(`/people?add=1&error=${encodeURIComponent(parsed.error)}`);
  if (!supabaseAdmin) redirect("/people?error=Database%20configuration%20is%20missing");
  const value = parsed.value;
  if (!auth.allLocations && !auth.locationIds.includes(value.locationId)) redirect("/people?add=1&error=Location%20access%20is%20not%20allowed");
  const [{ data: location, error: locationError }, { data: designation, error: designationError }] = await Promise.all([
    supabaseAdmin.from("stations").select("id, station_code, station_name, location_model_id").eq("company_id", auth.companyId).eq("id", value.locationId).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", auth.companyId).eq("id", value.designationId).eq("is_active", true).maybeSingle()
  ]);
  if (locationError || !location) redirect("/people?add=1&error=Select%20a%20valid%20work%20location");
  if (designationError || !designation || !isEmployeeDesignation(designation)) redirect("/people?add=1&error=Select%20a%20valid%20employee%20designation");
  if (employeeDesignationsForLocation([designation], location).length !== 1) redirect("/people?add=1&error=Designation%20is%20not%20available%20at%20the%20selected%20location");
  const employeeCode = value.autoGenerateEmployeeCode ? `EMP-${Date.now().toString(36).toUpperCase()}` : value.employeeCode;
  let biometricId = value.biometricId;
  try {
    biometricId ||= await generateBiometricEnrolmentId(auth.companyId);
  } catch (error) {
    redirect(`/people?add=1&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to generate biometric enrolment ID")}`);
  }
  const { data: employee, error } = await supabaseAdmin.from("employees").insert({
    company_id: auth.companyId,
    employee_code: employeeCode,
    biometric_id: biometricId,
    full_name: value.fullName,
    mobile_country_code: value.mobileCountryCode,
    mobile: value.mobile,
    email: value.email,
    date_of_join: value.dateOfJoin,
    location_id: value.locationId,
    designation_id: value.designationId,
    statutory_applicability: value.statutoryApplicability,
    profile_completion_status: "pending",
    is_active: true,
    created_by: auth.userId
  }).select("id").single();
  if (error || !employee) redirect(`/people?add=1&error=${encodeURIComponent(error?.message ?? "Employee could not be created")}`);
  try {
    await syncEmployeeBiometricEnrolment({ companyId: auth.companyId, createdBy: auth.userId, effectiveFrom: value.dateOfJoin, employeeId: employee.id, enrolmentId: biometricId, locationId: value.locationId });
  } catch (syncError) {
    redirect(`/people?error=${encodeURIComponent(syncError instanceof Error ? `Employee created, but biometric enrolment failed: ${syncError.message}` : "Employee created, but biometric enrolment failed")}`);
  }
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
