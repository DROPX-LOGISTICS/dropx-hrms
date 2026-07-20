import { describe, expect, it } from "vitest";
import { can, hrmsPermissions, permissionsForRole } from "./permissions";

describe("permissionsForRole", () => {
  it("grants every permission to owners", () => {
    const result = permissionsForRole("OWNER");
    expect([...result]).toEqual(hrmsPermissions);
  });

  it("grants every permission to a master owner regardless of role", () => {
    expect(permissionsForRole("VIEWER", true).size).toBe(hrmsPermissions.length);
  });

  it("limits employee access", () => {
    const result = permissionsForRole("employee");
    expect(can(result, "leave.request")).toBe(true);
    expect(can(result, "leave.approve")).toBe(false);
    expect(can(result, "settings.manage")).toBe(false);
  });

  it("returns no permissions for unknown roles", () => {
    expect(permissionsForRole("UNKNOWN").size).toBe(0);
    expect(permissionsForRole(undefined).size).toBe(0);
  });

  it("normalizes manager roles", () => {
    expect(can(permissionsForRole(" hr_manager "), "people.manage")).toBe(true);
    expect(can(permissionsForRole("manager"), "settings.manage")).toBe(false);
    expect(can(permissionsForRole("viewer"), "people.view")).toBe(true);
  });

  it("checks individual permission membership", () => {
    expect(can(new Set<import("./permissions").HrmsPermission>(["people.view"]), "people.view")).toBe(true);
    expect(can(new Set<import("./permissions").HrmsPermission>(["people.view"]), "people.manage")).toBe(false);
  });
});
