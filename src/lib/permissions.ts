export const hrmsPermissions = [
  "overview.view",
  "people.view",
  "people.manage",
  "attendance.view",
  "leave.view",
  "leave.request",
  "leave.approve",
  "settings.manage"
] as const;

export type HrmsPermission = (typeof hrmsPermissions)[number];

const rolePermissions: Record<string, readonly HrmsPermission[]> = {
  OWNER: hrmsPermissions,
  HRMS_ADMIN: hrmsPermissions,
  HR_MANAGER: ["overview.view", "people.view", "people.manage", "attendance.view", "leave.view", "leave.request", "leave.approve"],
  MANAGER: ["overview.view", "people.view", "attendance.view", "leave.view", "leave.request", "leave.approve"],
  EMPLOYEE: ["overview.view", "people.view", "attendance.view", "leave.view", "leave.request"],
  VIEWER: ["overview.view", "people.view", "attendance.view", "leave.view"]
};

export function permissionsForRole(roleCode: string | null | undefined, masterOwner = false) {
  if (masterOwner) return new Set<HrmsPermission>(hrmsPermissions);
  return new Set<HrmsPermission>(rolePermissions[String(roleCode ?? "").trim().toUpperCase()] ?? []);
}

export function can(permissionSet: Set<HrmsPermission>, permission: HrmsPermission) {
  return permissionSet.has(permission);
}
