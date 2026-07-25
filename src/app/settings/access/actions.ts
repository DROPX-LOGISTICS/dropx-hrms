"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { hrmsRoles, type HrmsRoleCode } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

const validRoleCodes = new Set<string>(hrmsRoles.map((role) => role.code));

function destination(message: string, kind: "notice" | "error") {
  return `/settings/access?${kind}=${encodeURIComponent(message)}`;
}

export async function saveHrmsUserAccess(formData: FormData) {
  const auth = await requireHrmsAuth("settings.manage");
  if (!supabaseAdmin) redirect(destination("Database configuration is missing.", "error"));

  const userId = String(formData.get("user_id") ?? "").trim();
  const roleCode = String(formData.get("role_code") ?? "").trim().toUpperCase() as HrmsRoleCode;
  const isActive = formData.get("is_active") === "active";
  const allLocations = formData.get("all_locations") === "on";
  if (!userId || !validRoleCodes.has(roleCode)) redirect(destination("Select a valid user and HRMS role.", "error"));
  if (userId === auth.userId && !isActive) redirect(destination("You cannot remove your own HRMS access.", "error"));

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, location_scope_ids")
    .eq("id", userId)
    .eq("company_id", auth.companyId)
    .maybeSingle();
  if (profileError || !profile) redirect(destination(profileError?.message ?? "User was not found in this company.", "error"));

  const locationIds = Array.isArray(profile.location_scope_ids) ? profile.location_scope_ids : [];
  const { error } = await supabaseAdmin.from("hr_user_access").upsert({
    company_id: auth.companyId,
    user_id: userId,
    role_code: roleCode,
    location_ids: allLocations ? [] : locationIds,
    all_locations: allLocations,
    is_active: isActive,
    created_by: auth.userId,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id,user_id" });
  if (error) redirect(destination(error.message, "error"));

  revalidatePath("/settings/access");
  redirect(destination("People access saved.", "notice"));
}
