"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { syncEmployeeBiometricEnrolment } from "@/lib/biometric";
import { EmployeeSalaryHead } from "@/lib/employee-salary-calculator";
import { parseEmployeeSalaryValues } from "@/lib/employee-salary-validation";
import { employeeDesignationsForLocation, isEmployeeDesignation } from "@/lib/employee-options";
import { generateEmployeeBiometricId, generateEmployeeCode } from "@/lib/id-generation";
import { replaceProfileDocument, uploadProfileDocument } from "@/lib/profile-document-storage";
import { saveProfileVerifications } from "@/lib/profile-verifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseEmployeeForm } from "@/lib/validation";
import { missingRequiredProfileFields, normalizeProfileFieldRules, profilePayloadForRules } from "@/lib/workforce-profile";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function updateEmployee(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const editPath = `/people/${employeeId}?edit=1`;
  if (!employeeId) redirect("/people?error=Employee%20is%20required");
  const parsed = parseEmployeeForm(formData);
  if (!parsed.ok) redirect(`${editPath}&error=${encodeURIComponent(parsed.error)}`);
  if (!supabaseAdmin) redirect(`${editPath}&error=Database%20configuration%20is%20missing`);
  const value = parsed.value;

  const { data: existing, error: existingError } = await supabaseAdmin.from("employees").select("id, location_id, employee_code, biometric_id, aadhaar_front_path, aadhaar_back_path, pan_upload_path, dl_front_path, dl_back_path, profile_photo_path").eq("company_id", auth.companyId).eq("id", employeeId).maybeSingle();
  if (existingError || !existing || (!auth.allLocations && !auth.locationIds.includes(existing.location_id ?? ""))) redirect("/people?error=Employee%20was%20not%20found");
  if (!auth.allLocations && !auth.locationIds.includes(value.locationId)) redirect(`${editPath}&error=Location%20access%20is%20not%20allowed`);

  const [{ data: location, error: locationError }, { data: designation, error: designationError }, categoryResult] = await Promise.all([
    supabaseAdmin.from("stations").select("id, station_code, station_name, location_model_id").eq("company_id", auth.companyId).eq("id", value.locationId).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", auth.companyId).eq("id", value.designationId).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("workforce_categories").select("profile_field_rules").eq("company_id", auth.companyId).eq("code", "employees").eq("is_active", true).maybeSingle()
  ]);
  if (locationError || !location) redirect(`${editPath}&error=Select%20a%20valid%20work%20location`);
  if (designationError || !designation || !isEmployeeDesignation(designation)) redirect(`${editPath}&error=Select%20a%20valid%20employee%20designation`);
  if (employeeDesignationsForLocation([designation], location).length !== 1) redirect(`${editPath}&error=Designation%20is%20not%20available%20at%20the%20selected%20location`);
  if (categoryResult.error && !categoryResult.error.message.toLowerCase().includes("does not exist") && !categoryResult.error.message.toLowerCase().includes("schema cache")) {
    redirect(`${editPath}&error=${encodeURIComponent(categoryResult.error.message)}`);
  }
  const profileRules = normalizeProfileFieldRules(categoryResult.data?.profile_field_rules).dashboard;

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
    is_handicapped: optional("is_handicapped") === null ? null : optional("is_handicapped") === "true",
    aadhaar_number: digits("aadhaar_number"),
    pan_number: optional("pan_number")?.toUpperCase() ?? null,
    eshram_uan: digits("eshram_uan"),
    address: optional("address"),
    state_code: optional("state_code")?.toUpperCase() ?? null,
    pincode: digits("pincode"),
    landmark: optional("landmark"),
    emergency_contact_name: optional("emergency_contact_name"),
    emergency_contact_number: digits("emergency_contact_number"),
    emergency_contact_relation: optional("emergency_contact_relation"),
    bank_account_no: optional("bank_account_no")?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() ?? null,
    ifsc: optional("ifsc")?.toUpperCase() ?? null,
    pf_uan: digits("pf_uan"),
    pf_account_no: optional("pf_account_no")?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() ?? null,
    esi_no: optional("esi_no")?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() ?? null,
    driving_license_no: optional("driving_license_no")?.toUpperCase() ?? null,
    driving_license_exp_date: optional("driving_license_exp_date"),
    vehicle_reg_no: optional("vehicle_reg_no")?.toUpperCase() ?? null,
    vehicle_reg_exp_date: optional("vehicle_reg_exp_date"),
    vehicle_insurance_exp_date: optional("vehicle_insurance_exp_date"),
    vehicle_pollution_exp_date: optional("vehicle_pollution_exp_date")
  };
  if (profile.aadhaar_number && !/^\d{12}$/.test(profile.aadhaar_number)) redirect(`${editPath}&error=Aadhaar%20number%20must%20contain%2012%20digits`);
  if (profile.pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(profile.pan_number)) redirect(`${editPath}&error=PAN%20number%20format%20is%20invalid`);
  if (profile.pincode && !/^\d{6}$/.test(profile.pincode)) redirect(`${editPath}&error=Postal%20PIN%20must%20contain%206%20digits`);
  if (profile.emergency_contact_number && !/^\d{10}$/.test(profile.emergency_contact_number)) redirect(`${editPath}&error=Emergency%20contact%20must%20contain%2010%20digits`);
  if (profile.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(profile.ifsc)) redirect(`${editPath}&error=IFSC%20format%20is%20invalid`);
  if (profile.pf_uan && !/^\d{12}$/.test(profile.pf_uan)) redirect(`${editPath}&error=PF%20UAN%20must%20contain%2012%20digits`);
  if (profile.date_of_birth && Number.isNaN(Date.parse(profile.date_of_birth))) redirect(`${editPath}&error=Enter%20a%20valid%20date%20of%20birth`);
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
  const missing = missingRequiredProfileFields(profile, profileRules, value.statutoryApplicability);
  if (missing.length) redirect(`${editPath}&error=${encodeURIComponent(`${requiredLabels[missing[0]] ?? missing[0]} is required`)}`);

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
        ownerId: employeeId,
        ownerType: "employee",
        fileValue: formData.get(field.formKey)
      });
      if (!replacementPath) continue;
      await replaceProfileDocument({
        companyId: auth.companyId,
        documentLabel: field.label,
        ownerId: employeeId,
        ownerType: "employee",
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
    hr_pay_type: value.hrPayType,
    ...profilePayloadForRules(profile, profileRules),
    ...uploads,
    is_active: isActive,
    updated_at: new Date().toISOString()
  }).eq("company_id", auth.companyId).eq("id", employeeId);
  if (error) redirect(`${editPath}&error=${encodeURIComponent(error.message)}`);

  await saveProfileVerifications({
    accountId: employeeId,
    companyId: auth.companyId,
    profileType: "employee",
    values: formData.getAll("profile_verification_results")
  });

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

export async function reviewEmployeeProfile(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const employeeId = String(formData.get("account_id") ?? "").trim();
  const action = String(formData.get("review_action") ?? "").trim().toLowerCase();
  const remarks = String(formData.get("return_remarks") ?? "").trim();
  const editPath = `/people/${employeeId}?edit=1`;
  if (!supabaseAdmin) redirect(`${editPath}&error=Database%20configuration%20is%20missing`);
  if (!["approve", "return"].includes(action)) redirect(`${editPath}&error=Choose%20a%20valid%20review%20action`);
  if (action === "return" && !remarks) redirect(`${editPath}&error=Return%20remarks%20are%20required`);

  let query = supabaseAdmin.from("employees").select("id, location_id, profile_completion_status").eq("company_id", auth.companyId).eq("id", employeeId);
  if (!auth.allLocations) query = query.in("location_id", auth.locationIds);
  const { data, error } = await query.maybeSingle();
  if (error || !data) redirect("/people?error=Employee%20was%20not%20found");
  if (String(data.profile_completion_status ?? "").toLowerCase() !== "under_review") {
    redirect(`${editPath}&error=Only%20profiles%20under%20review%20can%20be%20approved%20or%20returned`);
  }

  const now = new Date().toISOString();
  const update = action === "approve"
    ? { profile_completion_status: "active", profile_return_remarks: null, profile_returned_at: null, profile_completed_at: now, updated_at: now }
    : { profile_completion_status: "returned", profile_return_remarks: remarks, profile_returned_at: now, updated_at: now };
  const result = await supabaseAdmin.from("employees").update(update).eq("company_id", auth.companyId).eq("id", employeeId).eq("profile_completion_status", "under_review");
  if (result.error) redirect(`${editPath}&error=${encodeURIComponent(result.error.message)}`);
  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath(`/people/${employeeId}`);
  redirect(`/people/${employeeId}?notice=${action === "approve" ? "Employee%20profile%20approved" : "Employee%20profile%20returned%20for%20correction"}`);
}

export async function saveEmployeeSalaryConfiguration(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const configurationId = String(formData.get("configuration_id") ?? "").trim();
  const effectiveFrom = String(formData.get("effective_from") ?? "").trim();
  const editPath = `/people/${employeeId}?edit=1&section=salary`;
  if (!UUID_PATTERN.test(employeeId)) redirect("/people?error=Select%20a%20valid%20employee");
  if (!UUID_PATTERN.test(configurationId)) redirect(`${editPath}&error=Select%20a%20valid%20salary%20configuration`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || Number.isNaN(Date.parse(`${effectiveFrom}T00:00:00Z`))) {
    redirect(`${editPath}&error=Select%20a%20valid%20salary%20effective%20date`);
  }
  if (!supabaseAdmin) redirect(`${editPath}&error=Database%20configuration%20is%20missing`);

  const [{ data: employee, error: employeeError }, { data: configuration, error: configurationError }] = await Promise.all([
    supabaseAdmin
      .from("employees")
      .select("id, location_id")
      .eq("company_id", auth.companyId)
      .eq("id", employeeId)
      .maybeSingle(),
    supabaseAdmin
      .from("hr_salary_configurations")
      .select("id, hr_salary_configuration_items(payroll_head_id, calculation_type, formula, fixed_amount, value_expression, minimum_value, maximum_value, is_enabled, hr_payroll_heads(code, name, head_type))")
      .eq("company_id", auth.companyId)
      .eq("id", configurationId)
      .eq("is_active", true)
      .maybeSingle()
  ]);
  if (employeeError || !employee || (!auth.allLocations && !auth.locationIds.includes(employee.location_id ?? ""))) {
    redirect("/people?error=Employee%20was%20not%20found");
  }
  if (configurationError || !configuration) {
    redirect(`${editPath}&error=Salary%20configuration%20is%20inactive%20or%20was%20not%20found`);
  }

  const relation = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] ?? null : value ?? null;
  const salaryHeads = (configuration.hr_salary_configuration_items ?? [])
    .filter((item) => item.is_enabled && relation(item.hr_payroll_heads))
    .map((item) => ({
      payrollHeadId: item.payroll_head_id,
      payrollHeadName: relation(item.hr_payroll_heads)?.name ?? "Payroll head",
      payrollHeadCode: relation(item.hr_payroll_heads)?.code ?? "",
      headType: relation(item.hr_payroll_heads)?.head_type ?? "employee_earning",
      calculationType: item.calculation_type,
      formula: item.value_expression ?? item.formula,
      fixedAmount: item.fixed_amount === null ? null : Number(item.fixed_amount),
      minimumValue: item.minimum_value === null ? null : Number(item.minimum_value),
      maximumValue: item.maximum_value === null ? null : Number(item.maximum_value)
    })) as EmployeeSalaryHead[];
  let values: Record<string, number>;
  try {
    values = parseEmployeeSalaryValues(
      formData.getAll("salary_value_head_id").map(String),
      formData.getAll("salary_value_amount").map(String),
      salaryHeads
    );
  } catch (error) {
    redirect(`${editPath}&error=${encodeURIComponent(error instanceof Error ? error.message : "Enter valid employee salary values")}`);
  }

  const { error } = await supabaseAdmin.rpc("hr_save_employee_salary_assignment", {
    p_company_id: auth.companyId,
    p_employee_id: employeeId,
    p_configuration_id: configurationId,
    p_effective_from: effectiveFrom,
    p_values: values,
    p_actor_user_id: auth.userId
  });
  if (error) redirect(`${editPath}&error=${encodeURIComponent(error.message)}`);

  revalidatePath(`/people/${employeeId}`);
  redirect(`${editPath}&notice=Salary%20configuration%20saved`);
}
