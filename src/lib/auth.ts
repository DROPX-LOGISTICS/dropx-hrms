import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { can, HrmsPermission, permissionsForRole } from "@/lib/permissions";

export type HrmsAuthContext = {
  userId: string;
  email: string;
  fullName: string;
  companyId: string;
  companyName: string;
  roleCode: string;
  permissions: Set<HrmsPermission>;
  locationIds: string[];
  allLocations: boolean;
};

export type HrmsAuthClientContext = Omit<HrmsAuthContext, "permissions"> & {
  permissions: HrmsPermission[];
};

export function toClientAuth(auth: HrmsAuthContext): HrmsAuthClientContext {
  return { ...auth, permissions: [...auth.permissions] };
}

function isMissingTable(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache");
}

async function loadHrmsAccess(userId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name, company_id, role_id, location_scope_ids, is_active, is_master_owner")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile?.is_active || !profile.company_id) return null;

  const [{ data: company }, roleResult] = await Promise.all([
    admin.from("companies").select("id, name, is_active").eq("id", profile.company_id).maybeSingle(),
    profile.role_id
      ? admin.from("user_roles").select("code, location_access_mode, is_active").eq("id", profile.role_id).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);
  if (!company?.is_active) return null;
  const existingRole = roleResult.data;

  const existingRoleCode = String(existingRole?.code ?? "").toUpperCase();
  const isOwner = Boolean(profile.is_master_owner) || existingRoleCode === "OWNER";
  let roleCode = isOwner ? "OWNER" : "";
  let locationIds = Array.isArray(profile.location_scope_ids)
    ? profile.location_scope_ids.filter((value): value is string => typeof value === "string")
    : [];
  let allLocations = isOwner || existingRole?.location_access_mode === "all_locations";

  if (!isOwner) {
    const { data: hrAccess, error } = await admin
      .from("hr_user_access")
      .select("role_code, location_ids, all_locations, is_active")
      .eq("company_id", profile.company_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error && !isMissingTable(error)) return null;
    if (!hrAccess?.is_active) return null;
    roleCode = String(hrAccess.role_code ?? "VIEWER").toUpperCase();
    locationIds = Array.isArray(hrAccess.location_ids) ? hrAccess.location_ids : locationIds;
    allLocations = Boolean(hrAccess.all_locations);
  }

  const permissions = permissionsForRole(roleCode, isOwner);
  if (!permissions.size) return null;
  return {
    userId,
    email: profile.email ?? "",
    fullName: profile.full_name ?? profile.email ?? "DropX user",
    companyId: profile.company_id,
    companyName: company.name,
    roleCode,
    permissionCodes: [...permissions],
    locationIds,
    allLocations
  };
}

export const getHrmsAuth = cache(async (): Promise<HrmsAuthContext | null> => {
  const authClient = createServerSupabaseClient();
  const admin = getSupabaseAdmin();
  if (!authClient || !admin) return null;
  const { data: authData } = await authClient.auth.getUser();
  const user = authData.user;
  if (!user) return null;
  const access = await loadHrmsAccess(user.id);
  if (!access) return null;
  const { permissionCodes, ...details } = access;
  return {
    ...details,
    email: user.email ?? access.email,
    permissions: new Set<HrmsPermission>(permissionCodes)
  };
});

export async function requireHrmsAuth(permission?: HrmsPermission) {
  const context = await getHrmsAuth();
  if (!context) redirect("/login?reason=HRMS%20access%20is%20not%20configured");
  if (permission && !can(context.permissions, permission)) redirect("/unauthorized");
  return context;
}
