export const hrmsPermissions = [
  "overview.view",
  "people.view",
  "people.manage",
  "attendance.view",
  "leave.view",
  "leave.request",
  "leave.approve",
  "exit.view",
  "exit.manage",
  "exit.approve",
  "payroll.view",
  "payroll.process",
  "settings.manage"
] as const;

export type HrmsPermission = (typeof hrmsPermissions)[number];

export const hrmsRoles = [
  { code: "HRMS_ADMIN", name: "HRMS Admin" },
  { code: "HR_MANAGER", name: "HR Manager" },
  { code: "MANAGER", name: "Manager" },
  { code: "EMPLOYEE", name: "Employee" },
  { code: "VIEWER", name: "Viewer" }
] as const;

export type HrmsRoleCode = (typeof hrmsRoles)[number]["code"];

const rolePermissions: Record<string, readonly HrmsPermission[]> = {
  OWNER: hrmsPermissions,
  HRMS_ADMIN: hrmsPermissions,
  HR_MANAGER: ["overview.view", "people.view", "people.manage", "attendance.view", "leave.view", "leave.request", "leave.approve", "exit.view", "exit.manage", "exit.approve"],
  MANAGER: ["overview.view", "people.view", "attendance.view", "leave.view", "leave.request", "leave.approve", "exit.view", "exit.approve"],
  EMPLOYEE: ["overview.view", "people.view", "attendance.view", "leave.view", "leave.request"],
  VIEWER: ["overview.view", "people.view", "attendance.view", "leave.view"]
};

export function permissionsForRole(roleCode: string | null | undefined, masterOwner = false) {
  if (masterOwner) return new Set<HrmsPermission>(hrmsPermissions);
  return new Set<HrmsPermission>(rolePermissions[String(roleCode ?? "").trim().toUpperCase()] ?? []);
}

export function can(permissionSet: ReadonlySet<HrmsPermission> | readonly HrmsPermission[], permission: HrmsPermission) {
  if (Array.isArray(permissionSet)) return permissionSet.includes(permission);
  return (permissionSet as ReadonlySet<HrmsPermission>).has(permission);
}
