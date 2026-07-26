"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { syncContractorBiometricEnrolment } from "@/lib/biometric";
import { contractorDesignationsForLocation, isContractorDesignation } from "@/lib/employee-options";
import { generateContractorBiometricId, generateContractorCode } from "@/lib/id-generation";
import { replaceProfileDocument, uploadProfileDocument } from "@/lib/profile-document-storage";
import { saveProfileVerifications } from "@/lib/profile-verifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseContractorForm } from "@/lib/validation";
import { missingRequiredProfileFields, normalizeProfileFieldRules, profilePayloadForRules } from "@/lib/workforce-profile";

function optional(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim() || null;
}

function digits(formData: FormData, name: string) {
  return optional(formData, name)?.replace(/\D/g, "") ?? null;
}

function editPath(id: string) {
  return `/people/contractors/${id}?edit=1`;
}

export async function updateContractor(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const contractorId = String(formData.get("contractor_id") ?? "").trim();
  if (!contractorId) redirect("/people/contractors?error=Contractor%20is%20required");
  const parsed = parseContractorForm(formData);
  if (!parsed.ok) redirect(`${editPath(contractorId)}&error=${encodeURIComponent(parsed.error)}`);
  if (!supabaseAdmin) redirect(`${editPath(contractorId)}&error=Database%20configuration%20is%20missing`);
  const value = parsed.value;

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("contractors")
    .select("id, location_id, dropx_id, biometric_id, aadhaar_front_path, aadhaar_back_path, pan_upload_path, dl_front_path, dl_back_path, profile_photo_path")
    .eq("company_id", auth.companyId)
    .eq("id", contractorId)
    .maybeSingle();
  if (existingError || !existing || (!auth.allLocations && !auth.locationIds.includes(existing.location_id ?? ""))) {
    redirect("/people/contractors?error=Contractor%20was%20not%20found");
  }
  if (!auth.allLocations && !auth.locationIds.includes(value.locationId)) redirect(`${editPath(contractorId)}&error=Location%20access%20is%20not%20allowed`);

  const [{ data: location, error: locationError }, { data: designation, error: designationError }, categoryResult] = await Promise.all([
    supabaseAdmin.from("stations").select("id, location_model_id").eq("company_id", auth.companyId).eq("id", value.locationId).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", auth.companyId).eq("name", value.designation).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("workforce_categories").select("profile_field_rules").eq("company_id", auth.companyId).eq("code", "contractors").eq("is_active", true).maybeSingle()
  ]);
  if (locationError || !location) redirect(`${editPath(contractorId)}&error=Select%20a%20valid%20work%20location`);
  if (designationError || !designation || !isContractorDesignation(designation)) redirect(`${editPath(contractorId)}&error=Select%20a%20valid%20contractor%20designation`);
  if (contractorDesignationsForLocation([designation], { ...location, station_code: "", station_name: null }).length !== 1) {
    redirect(`${editPath(contractorId)}&error=Designation%20is%20not%20available%20at%20the%20selected%20location`);
  }
  if (categoryResult.error && !categoryResult.error.message.toLowerCase().includes("does not exist") && !categoryResult.error.message.toLowerCase().includes("schema cache")) {
    redirect(`${editPath(contractorId)}&error=${encodeURIComponent(categoryResult.error.message)}`);
  }
  const profileRules = normalizeProfileFieldRules(categoryResult.data?.profile_field_rules).dashboard;

  let dropxId = existing.dropx_id;
  let biometricId = existing.biometric_id;
  try {
    const idContext = {
      companyId: auth.companyId,
      designationId: designation.id,
      locationId: value.locationId,
      modelId: location.location_model_id
    };
    dropxId ||= await generateContractorCode(idContext);
    biometricId ||= await generateContractorBiometricId(idContext);
  } catch (error) {
    redirect(`${editPath(contractorId)}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to generate contractor identifiers")}`);
  }
  if (!dropxId || !/^[A-Z0-9_-]{2,32}$/.test(dropxId)) redirect(`${editPath(contractorId)}&error=Generated%20contractor%20ID%20has%20an%20invalid%20format`);
  if (!biometricId || !/^\d{1,20}$/.test(biometricId)) redirect(`${editPath(contractorId)}&error=Generated%20biometric%20ID%20must%20contain%201%20to%2020%20digits`);

  const profile = {
    gender: optional(formData, "gender"),
    date_of_birth: optional(formData, "date_of_birth"),
    father_name: optional(formData, "father_name"),
    blood_group: optional(formData, "blood_group"),
    is_handicapped: optional(formData, "is_handicapped") === null ? null : optional(formData, "is_handicapped") === "true",
    aadhaar_number: digits(formData, "aadhaar_number"),
    pan_number: optional(formData, "pan_number")?.toUpperCase() ?? null,
    eshram_uan: digits(formData, "eshram_uan"),
    address: optional(formData, "address"),
    state_code: optional(formData, "state_code")?.toUpperCase() ?? null,
    postal_pin: digits(formData, "postal_pin"),
    landmark: optional(formData, "landmark"),
    emergency_contact_name: optional(formData, "emergency_contact_name"),
    emergency_contact_number: digits(formData, "emergency_contact_number"),
    emergency_contact_relation: optional(formData, "emergency_contact_relation"),
    bank_account_no: optional(formData, "bank_account_no")?.toUpperCase() ?? null,
    ifsc_code: optional(formData, "ifsc_code")?.toUpperCase() ?? null,
    pf_uan: digits(formData, "pf_uan"),
    pf_account_no: optional(formData, "pf_account_no")?.toUpperCase() ?? null,
    esi_no: optional(formData, "esi_no")?.toUpperCase() ?? null,
    driving_license_no: optional(formData, "driving_license_no")?.toUpperCase() ?? null,
    driving_license_exp_date: optional(formData, "driving_license_exp_date"),
    vehicle_reg_no: optional(formData, "vehicle_reg_no")?.toUpperCase() ?? null,
    vehicle_reg_exp_date: optional(formData, "vehicle_reg_exp_date"),
    vehicle_insurance_exp_date: optional(formData, "vehicle_insurance_exp_date"),
    vehicle_pollution_exp_date: optional(formData, "vehicle_pollution_exp_date")
  };
  if (profile.aadhaar_number && !/^\d{12}$/.test(profile.aadhaar_number)) redirect(`${editPath(contractorId)}&error=Aadhaar%20number%20must%20contain%2012%20digits`);
  if (profile.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profile.pan_number)) redirect(`${editPath(contractorId)}&error=PAN%20number%20format%20is%20invalid`);
  if (profile.postal_pin && !/^\d{6}$/.test(profile.postal_pin)) redirect(`${editPath(contractorId)}&error=Postal%20PIN%20must%20contain%206%20digits`);
  if (profile.emergency_contact_number && !/^\d{10}$/.test(profile.emergency_contact_number)) redirect(`${editPath(contractorId)}&error=Emergency%20contact%20must%20contain%2010%20digits`);
  if (profile.ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profile.ifsc_code)) redirect(`${editPath(contractorId)}&error=IFSC%20format%20is%20invalid`);
  if (profile.pf_uan && !/^\d{12}$/.test(profile.pf_uan)) redirect(`${editPath(contractorId)}&error=PF%20UAN%20must%20contain%2012%20digits`);
  const statutory = formData.getAll("statutory_applicability").map(String).filter((item) => ["not_applicable", "pf", "esi"].includes(item));
  const statutoryApplicability = !statutory.length || statutory.includes("not_applicable") ? ["not_applicable"] : [...new Set(statutory)];
  const profileRuleValues = { ...profile, pincode: profile.postal_pin, ifsc: profile.ifsc_code };
  const requiredLabels: Record<string, string> = {
    gender: "Gender", date_of_birth: "Date of birth", father_name: "Father name", blood_group: "Blood group",
    aadhaar_number: "Aadhaar number", pan_number: "PAN number", eshram_uan: "eShram UAN", is_handicapped: "Handicapped",
    address: "Address", state_code: "State", pincode: "Postal PIN", landmark: "Landmark", bank_account_no: "Bank account number",
    ifsc: "IFSC", pf_uan: "PF UAN", pf_account_no: "PF account no", esi_no: "ESI no",
    driving_license_no: "Driving licence number", driving_license_exp_date: "DL expiry date", vehicle_reg_no: "Vehicle registration number",
    vehicle_reg_exp_date: "Vehicle registration expiry", vehicle_insurance_exp_date: "Vehicle insurance expiry",
    vehicle_pollution_exp_date: "Pollution expiry", emergency_contact_name: "Emergency contact name",
    emergency_contact_number: "Emergency contact number", emergency_contact_relation: "Emergency contact relation"
  };
  const missing = missingRequiredProfileFields(profileRuleValues, profileRules, statutoryApplicability);
  if (missing.length) redirect(`${editPath(contractorId)}&error=${encodeURIComponent(`${requiredLabels[missing[0]] ?? missing[0]} is required`)}`);

  const uploadFields = [
    { formKey: "aadhaar_front_file", pathKey: "aadhaar_front_path", label: "Aadhaar front" },
    { formKey: "aadhaar_back_file", pathKey: "aadhaar_back_path", label: "Aadhaar back" },
    { formKey: "pan_upload_file", pathKey: "pan_upload_path", label: "PAN upload" },
    { formKey: "dl_front_file", pathKey: "dl_front_path", label: "DL front" },
    { formKey: "dl_back_file", pathKey: "dl_back_path", label: "DL back" },
    { formKey: "profile_photo_file", pathKey: "profile_photo_path", label: "Profile photo" }
  ] as const;
  const uploads: Record<string, string> = {};
  try {
    for (const field of uploadFields) {
      if (!profileRules.enabled.includes(field.pathKey.replace("_path", ""))) continue;
      const replacementPath = await uploadProfileDocument({
        companyId: auth.companyId,
        documentKey: field.pathKey.replace("_path", ""),
        ownerId: contractorId,
        ownerType: "contractor",
        fileValue: formData.get(field.formKey)
      });
      if (!replacementPath) continue;
      await replaceProfileDocument({
        companyId: auth.companyId,
        documentLabel: field.label,
        ownerId: contractorId,
        ownerType: "contractor",
        existingPath: existing[field.pathKey],
        replacedBy: auth.userId
      });
      uploads[field.pathKey] = replacementPath;
    }
  } catch (error) {
    redirect(`${editPath(contractorId)}&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to upload contractor documents")}`);
  }

  const isActive = String(formData.get("is_active") ?? "true") !== "false";
  const { error } = await supabaseAdmin.from("contractors").update({
    dropx_id: dropxId,
    biometric_id: biometricId,
    full_name: value.fullName,
    mobile_country_code: value.mobileCountryCode,
    mobile: value.mobile,
    email: value.email,
    date_of_join: value.dateOfJoin,
    location_id: value.locationId,
    designation: value.designation,
    statutory_applicability: statutoryApplicability,
    ...profilePayloadForRules(profile, profileRules, { pincode: "postal_pin", ifsc: "ifsc_code" }),
    ...uploads,
    is_active: isActive,
    updated_at: new Date().toISOString()
  }).eq("company_id", auth.companyId).eq("id", contractorId);
  if (error) redirect(`${editPath(contractorId)}&error=${encodeURIComponent(error.message)}`);

  await saveProfileVerifications({
    accountId: contractorId,
    companyId: auth.companyId,
    profileType: "contractor",
    values: formData.getAll("profile_verification_results")
  });
  try {
    await syncContractorBiometricEnrolment({
      companyId: auth.companyId,
      createdBy: auth.userId,
      effectiveFrom: value.dateOfJoin,
      contractorId,
      enrolmentId: biometricId,
      isActive,
      locationId: value.locationId
    });
  } catch (syncError) {
    redirect(`/people/contractors/${contractorId}?error=${encodeURIComponent(syncError instanceof Error ? `Contractor updated, but biometric enrolment failed: ${syncError.message}` : "Contractor updated, but biometric enrolment failed")}`);
  }

  revalidatePath("/people/contractors");
  revalidatePath(`/people/contractors/${contractorId}`);
  redirect(`/people/contractors/${contractorId}?notice=Independent%20contractor%20updated`);
}

export async function reviewContractorProfile(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const contractorId = String(formData.get("account_id") ?? "").trim();
  const action = String(formData.get("review_action") ?? "").trim().toLowerCase();
  const remarks = String(formData.get("return_remarks") ?? "").trim();
  if (!supabaseAdmin) redirect(`/people/contractors/${contractorId}?error=Database%20configuration%20is%20missing`);
  if (!["approve", "return"].includes(action)) redirect(`${editPath(contractorId)}&error=Choose%20a%20valid%20review%20action`);
  if (action === "return" && !remarks) redirect(`${editPath(contractorId)}&error=Return%20remarks%20are%20required`);

  let query = supabaseAdmin.from("contractors").select("id, location_id, onboarding_status").eq("company_id", auth.companyId).eq("id", contractorId);
  if (!auth.allLocations) query = query.in("location_id", auth.locationIds);
  const { data, error } = await query.maybeSingle();
  if (error || !data) redirect("/people/contractors?error=Contractor%20was%20not%20found");
  if (String(data.onboarding_status ?? "").toLowerCase() !== "under_review") {
    redirect(`${editPath(contractorId)}&error=Only%20profiles%20under%20review%20can%20be%20approved%20or%20returned`);
  }

  const now = new Date().toISOString();
  const update = action === "approve"
    ? { onboarding_status: "active", profile_return_remarks: null, profile_returned_at: null, updated_at: now }
    : { onboarding_status: "returned", profile_return_remarks: remarks, profile_returned_at: now, updated_at: now };
  const result = await supabaseAdmin.from("contractors").update(update).eq("company_id", auth.companyId).eq("id", contractorId).eq("onboarding_status", "under_review");
  if (result.error) redirect(`${editPath(contractorId)}&error=${encodeURIComponent(result.error.message)}`);
  revalidatePath("/people/contractors");
  revalidatePath(`/people/contractors/${contractorId}`);
  redirect(`/people/contractors/${contractorId}?notice=${action === "approve" ? "Contractor%20profile%20approved" : "Contractor%20profile%20returned%20for%20correction"}`);
}
