"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { syncEmployeeBiometricEnrolment } from "@/lib/biometric";
import { employeeDesignationsForLocation, isEmployeeDesignation } from "@/lib/employee-options";
import { generateEmployeeBiometricId } from "@/lib/id-generation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseEmployeeForm } from "@/lib/validation";

export async function updateEmployee(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const editPath = `/people/${employeeId}?edit=1`;
  if (!employeeId) redirect("/people?error=Employee%20is%20required");
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) redirect(`${editPath}&error=${encodeURIComponent(parsed.error)}`);
  if (!supabaseAdmin) redirect(`${editPath}&error=Database%20configuration%20is%20missing`);
  const value = parsed.value;

  const { data: existing, error: existingError } = await supabaseAdmin.from("employees").select("id, location_id").eq("company_id", auth.companyId).eq("id", employeeId).maybeSingle();
  if (existingError || !existing || (!auth.allLocations && !auth.locationIds.includes(existing.location_id ?? ""))) redirect("/people?error=Employee%20was%20not%20found");
  if (!auth.allLocations && !auth.locationIds.includes(value.locationId)) redirect(`${editPath}&error=Location%20access%20is%20not%20allowed`);

  const [{ data: location, error: locationError }, { data: designation, error: designationError }] = await Promise.all([
    supabaseAdmin.from("stations").select("id, station_code, station_name, location_model_id").eq("company_id", auth.companyId).eq("id", value.locationId).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", auth.companyId).eq("id", value.designationId).eq("is_active", true).maybeSingle()
  ]);
  if (locationError || !location) redirect(`${editPath}&error=Select%20a%20valid%20work%20location`);
  if (designationError || !designation || !isEmployeeDesignation(designation)) redirect(`${editPath}&error=Select%20a%20valid%20employee%20designation`);
  if (employeeDesignationsForLocation([designation], location).length !== 1) redirect(`${editPath}&error=Designation%20is%20not%20available%20at%20the%20selected%20location`);

  let biometricId = value.biometricId;
  try {
    biometricId ||= await generateEmployeeBiometricId({
      companyId: auth.companyId,
      designationId: value.designationId,
      locationId: value.locationId,
      modelId: location.location_model_id
    });
  } catch (error) {
    redirect(`${editPath}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to generate biometric enrolment ID")}`);
  }
  if (!biometricId || !/^\d{1,20}$/.test(biometricId)) redirect(`${editPath}&error=Generated%20biometric%20ID%20must%20contain%201%20to%2020%20digits`);

  const { error } = await supabaseAdmin.from("employees").update({
    employee_code: value.employeeCode,
    biometric_id: biometricId,
    full_name: value.fullName,
    mobile_country_code: value.mobileCountryCode,
    mobile: value.mobile,
    email: value.email,
    date_of_join: value.dateOfJoin,
    location_id: value.locationId,
    designation_id: value.designationId,
    statutory_applicability: value.statutoryApplicability,
    updated_at: new Date().toISOString()
  }).eq("company_id", auth.companyId).eq("id", employeeId);
  if (error) redirect(`${editPath}&error=${encodeURIComponent(error.message)}`);

  try {
    await syncEmployeeBiometricEnrolment({ companyId: auth.companyId, createdBy: auth.userId, effectiveFrom: value.dateOfJoin, employeeId, enrolmentId: biometricId, locationId: value.locationId });
  } catch (syncError) {
    redirect(`/people/${employeeId}?error=${encodeURIComponent(syncError instanceof Error ? `Employee updated, but biometric enrolment failed: ${syncError.message}` : "Employee updated, but biometric enrolment failed")}`);
  }

  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  redirect(`/people/${employeeId}?notice=Employee%20updated`);
}
