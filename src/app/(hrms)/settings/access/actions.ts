"use server";

import { revalidatePath } from "next/cache";
import { requireHrmsAuth } from "@/lib/auth";
import { actionError, actionSuccess, type ActionFeedbackState } from "@/lib/action-feedback";
import { hrmsRoles, type HrmsRoleCode } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";

const validRoleCodes = new Set<string>(hrmsRoles.map((role) => role.code));

export async function saveHrmsUserAccess(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");
  if (!supabaseAdmin) return actionError("Database configuration is missing.");

  const userId = String(formData.get("user_id") ?? "").trim();
  const roleCode = String(formData.get("role_code") ?? "").trim().toUpperCase() as HrmsRoleCode;
  const isActive = formData.get("is_active") === "active";
  const allLocations = formData.get("all_locations") === "on";
  if (!userId || !validRoleCodes.has(roleCode)) return actionError("Select a valid user and HRMS role.");
  if (userId === auth.userId && !isActive) return actionError("You cannot remove your own HRMS access.");

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, location_scope_ids")
    .eq("id", userId)
    .eq("company_id", auth.companyId)
    .maybeSingle();
  if (profileError || !profile) return actionError(profileError?.message ?? "User was not found in this company.");

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
  if (error) return actionError(error.message);

  revalidatePath("/settings/access");
  return actionSuccess("People access saved.");
}
