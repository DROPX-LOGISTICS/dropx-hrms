"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { syncContractorBiometricEnrolment } from "@/lib/biometric";
import { contractorDesignationsForLocation, isContractorDesignation } from "@/lib/employee-options";
import { generateContractorBiometricId, generateContractorCode } from "@/lib/id-generation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseContractorForm } from "@/lib/validation";

export async function createContractor(formData: FormData) {
  const auth = await requireHrmsAuth("people.manage");
  const parsed = parseContractorForm(formData);
  if (!parsed.ok) redirect(`/people/contractors?add=1&error=${encodeURIComponent(parsed.error)}`);
  if (!supabaseAdmin) redirect("/people/contractors?error=Database%20configuration%20is%20missing");
  const value = parsed.value;
  if (!auth.allLocations && !auth.locationIds.includes(value.locationId)) {
    redirect("/people/contractors?add=1&error=Location%20access%20is%20not%20allowed");
  }

  const [{ data: location, error: locationError }, { data: designation, error: designationError }] = await Promise.all([
    supabaseAdmin.from("stations").select("id, station_code, station_name, location_model_id").eq("company_id", auth.companyId).eq("id", value.locationId).eq("is_active", true).maybeSingle(),
    supabaseAdmin.from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", auth.companyId).eq("name", value.designation).eq("is_active", true).maybeSingle()
  ]);
  if (locationError || !location) redirect("/people/contractors?add=1&error=Select%20a%20valid%20work%20location");
  if (designationError || !designation || !isContractorDesignation(designation)) {
    redirect("/people/contractors?add=1&error=Select%20a%20valid%20contractor%20designation");
  }
  if (contractorDesignationsForLocation([designation], location).length !== 1) {
    redirect("/people/contractors?add=1&error=Designation%20is%20not%20available%20at%20the%20selected%20location");
  }

  let dropxId = "";
  let biometricId = "";
  try {
    const idContext = {
      companyId: auth.companyId,
      designationId: designation.id,
      locationId: value.locationId,
      modelId: location.location_model_id
    };
    [dropxId, biometricId] = await Promise.all([
      generateContractorCode(idContext),
      generateContractorBiometricId(idContext)
    ]);
  } catch (error) {
    redirect(`/people/contractors?add=1&error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to generate contractor identifiers")}`);
  }
  if (!dropxId || !/^[A-Z0-9_-]{2,32}$/.test(dropxId)) redirect("/people/contractors?add=1&error=Generated%20contractor%20ID%20has%20an%20invalid%20format");
  if (!biometricId || !/^\d{1,20}$/.test(biometricId)) redirect("/people/contractors?add=1&error=Generated%20biometric%20ID%20must%20contain%201%20to%2020%20digits");

  const { data: contractor, error } = await supabaseAdmin.from("contractors").insert({
    company_id: auth.companyId,
    dropx_id: dropxId,
    biometric_id: biometricId,
    full_name: value.fullName,
    mobile_country_code: value.mobileCountryCode,
    mobile: value.mobile,
    email: value.email,
    date_of_join: value.dateOfJoin,
    location_id: value.locationId,
    designation: value.designation,
    onboarding_status: "pending",
    is_active: true,
    created_by: auth.userId
  }).select("id").single();
  if (error || !contractor) {
    const message = error?.message.toLowerCase().includes("duplicate") || error?.message.toLowerCase().includes("unique")
      ? "Contractor ID, mobile number, or email is already registered."
      : error?.message ?? "Contractor could not be created.";
    redirect(`/people/contractors?add=1&error=${encodeURIComponent(message)}`);
  }

  try {
    await syncContractorBiometricEnrolment({
      companyId: auth.companyId,
      createdBy: auth.userId,
      effectiveFrom: value.dateOfJoin,
      contractorId: contractor.id,
      enrolmentId: biometricId,
      locationId: value.locationId
    });
  } catch (syncError) {
    redirect(`/people/contractors?error=${encodeURIComponent(syncError instanceof Error ? `Contractor created, but biometric enrolment failed: ${syncError.message}` : "Contractor created, but biometric enrolment failed")}`);
  }

  revalidatePath("/people/contractors");
  redirect("/people/contractors?notice=Independent%20contractor%20created");
}
