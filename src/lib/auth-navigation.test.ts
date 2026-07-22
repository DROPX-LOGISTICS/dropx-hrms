import { describe, expect, it } from "vitest";
import { AUTH_RETURN_COOKIE, AUTH_RETURN_TTL_SECONDS, resolveAuthReturnPath } from "./auth-navigation";

describe("auth navigation", () => {
  it("uses a safe cookie return path before the legacy callback query", () => {
    expect(resolveAuthReturnPath("/people?status=active", "/attendance")).toBe("/people?status=active");
  });

  it("supports the legacy callback query when no cookie is present", () => {
    expect(resolveAuthReturnPath(null, "/attendance")).toBe("/attendance");
  });

  it("rejects external return URLs", () => {
    expect(resolveAuthReturnPath("https://dashboard.dropxlogistics.com", "/attendance")).toBe("/");
    expect(resolveAuthReturnPath("//dashboard.dropxlogistics.com", "/attendance")).toBe("/");
  });

  it("keeps the return cookie short-lived and namespaced", () => {
    expect(AUTH_RETURN_COOKIE).toBe("dropx-hrms-auth-return");
    expect(AUTH_RETURN_TTL_SECONDS).toBe(600);
  });
});
