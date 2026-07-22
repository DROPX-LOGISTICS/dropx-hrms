"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { syncEmployeeBiometricEnrolment } from "@/lib/biometric";
import { employeeDesignationsForLocation, isEmployeeDesignation } from "@/lib/employee-options";
import { generateEmployeeBiometricId, generateEmployeeCode } from "@/lib/id-generation";
import { replaceEmployeeProfileDocument, uploadEmployeeProfileDocument } from "@/lib/profile-document-storage";
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

  const { data: existing, error: existingError } = await supabaseAdmin.from("employees").select("id, location_id, employee_code, biometric_id, aadhaar_front_path, aadhaar_back_path, pan_upload_path, profile_photo_path").eq("company_id", auth.companyId).eq("id", employeeId).maybeSingle();
  if (existingError || !existing || (!auth.allLocations && !auth.locationIds.includes(existing.location_id ?? ""))) redirect("/people?error=Employee%20was%20not%20found");
  if (!auth.allLocations && !auth.locationIds.includes(value.locationId)) redirect(`${editPath}&error=Location%20access%20is%20not%20allowed`);

  const [{ data: location, error: locationError }, { data: designation, error: designationError }] = await Promise.all([
    supabaseAdmin.from("stations").select("id, station_code, station_name, location_model_id").eq("company_id", auth.companyId).eq("id", value.locationId).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", auth.companyId).eq("id", value.designationId).eq("is_active", true).maybeSingle()
  ]);
  if (locationError || !location) redirect(`${editPath}&error=Select%20a%20valid%20work%20location`);
  if (designationError || !designation || !isEmployeeDesignation(designation)) redirect(`${editPath}&error=Select%20a%20valid%20employee%20designation`);
  if (employeeDesignationsForLocation([designation], location).length !== 1) redirect(`${editPath}&error=Designation%20is%20not%20available%20at%20the%20selected%20location`);

  let employeeCode = existing.employee_code;
  let biometricId = existing.biometric_id;
  try {
    const idContext = {
      companyId: auth.companyId,
      designationId: value.designationId,
      locationId: value.locationId,
      modelId: location.location_model_id
    };
    biometricId ||= await generateEmployeeBiometricId(idContext);
    employeeCode ||= await generateEmployeeCode(idContext);
  } catch (error) {
    redirect(`${editPath}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to generate employee identifiers")}`);
  }
  if (!employeeCode || !/^[A-Z0-9_-]{2,32}$/.test(employeeCode)) redirect(`${editPath}&error=Generated%20employee%20ID%20has%20an%20invalid%20format`);
  if (!biometricId || !/^\d{1,20}$/.test(biometricId)) redirect(`${editPath}&error=Generated%20biometric%20ID%20must%20contain%201%20to%2020%20digits`);

  const optional = (name: string) => String(formData.get(name) ?? "").trim() || null;
  const digits = (name: string) => optional(name)?.replace(/\D/g, "") ?? null;
  const profile = {
    gender: optional("gender"),
    date_of_birth: optional("date_of_birth"),
    father_name: optional("father_name"),
    blood_group: optional("blood_group"),
    aadhaar_number: digits("aadhaar_number"),
    pan_number: optional("pan_number")?.toUpperCase() ?? null,
    address: optional("address"),
    state_code: optional("state_code")?.toUpperCase() ?? null,
    pincode: digits("pincode"),
    landmark: optional("landmark"),
    emergency_contact_name: optional("emergency_contact_name"),
    emergency_contact_number: digits("emergency_contact_number"),
    emergency_contact_relation: optional("emergency_contact_relation"),
    bank_account_no: digits("bank_account_no"),
    ifsc: optional("ifsc")?.toUpperCase() ?? null
  };
  if (profile.aadhaar_number && !/^\d{12}$/.test(profile.aadhaar_number)) redirect(`${editPath}&error=Aadhaar%20number%20must%20contain%2012%20digits`);
  if (profile.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profile.pan_number)) redirect(`${editPath}&error=PAN%20number%20format%20is%20invalid`);
  if (profile.pincode && !/^\d{6}$/.test(profile.pincode)) redirect(`${editPath}&error=Postal%20PIN%20must%20contain%206%20digits`);
  if (profile.emergency_contact_number && !/^\d{10}$/.test(profile.emergency_contact_number)) redirect(`${editPath}&error=Emergency%20contact%20must%20contain%2010%20digits`);
  if (profile.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profile.ifsc)) redirect(`${editPath}&error=IFSC%20format%20is%20invalid`);
  if (profile.date_of_birth && Number.isNaN(Date.parse(profile.date_of_birth))) redirect(`${editPath}&error=Enter%20a%20valid%20date%20of%20birth`);

  const uploadFields = [
    { formKey: "aadhaar_front_file", pathKey: "aadhaar_front_path", label: "Aadhaar front" },
    { formKey: "aadhaar_back_file", pathKey: "aadhaar_back_path", label: "Aadhaar back" },
    { formKey: "pan_upload_file", pathKey: "pan_upload_path", label: "PAN upload" },
    { formKey: "profile_photo_file", pathKey: "profile_photo_path", label: "Profile photo" }
  ] as const;
  const uploads: Record<string, string> = {};
  try {
    for (const field of uploadFields) {
      const replacementPath = await uploadEmployeeProfileDocument({
        companyId: auth.companyId,
        documentKey: field.pathKey.replace("_path", ""),
        employeeId,
        fileValue: formData.get(field.formKey)
      });
      if (!replacementPath) continue;
      await replaceEmployeeProfileDocument({
        companyId: auth.companyId,
        documentLabel: field.label,
        employeeId,
        existingPath: existing[field.pathKey],
        replacedBy: auth.userId
      });
      uploads[field.pathKey] = replacementPath;
    }
  } catch (error) {
    redirect(`${editPath}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to upload employee documents")}`);
  }

  const isActive = String(formData.get("is_active") ?? "true") !== "false";
  const { error } = await supabaseAdmin.from("employees").update({
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
    ...profile,
    ...uploads,
    is_active: isActive,
    updated_at: new Date().toISOString()
  }).eq("company_id", auth.companyId).eq("id", employeeId);
  if (error) redirect(`${editPath}&error=${encodeURIComponent(error.message)}`);

  try {
    await syncEmployeeBiometricEnrolment({ companyId: auth.companyId, createdBy: auth.userId, effectiveFrom: value.dateOfJoin, employeeId, enrolmentId: biometricId, isActive, locationId: value.locationId });
  } catch (syncError) {
    redirect(`/people/${employeeId}?error=${encodeURIComponent(syncError instanceof Error ? `Employee updated, but biometric enrolment failed: ${syncError.message}` : "Employee updated, but biometric enrolment failed")}`);
  }

  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  redirect(`/people/${employeeId}?notice=Employee%20updated`);
}
