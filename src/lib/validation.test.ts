import { describe, expect, it } from "vitest";
import { parseEmployeeForm, parseLeaveRequest, safeReturnPath } from "./validation";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("parseEmployeeForm", () => {
  const valid = { full_name: "Asha Nair", mobile: "9876543210", email: "asha@example.com", date_of_join: "2026-07-20", location_id: "station-1" };
  it("normalizes valid employee input", () => {
    const result = parseEmployeeForm(form({ ...valid, employee_code: " DX-1 ", biometric_id: " 44 " }));
    expect(result).toEqual({ ok: true, value: { employeeCode: "DX-1", fullName: "Asha Nair", mobile: "9876543210", email: "asha@example.com", dateOfJoin: "2026-07-20", locationId: "station-1", designationId: null, biometricId: "44" } });
  });
  it("accepts empty optional employee fields and strips mobile punctuation", () => {
    const result = parseEmployeeForm(form({ ...valid, mobile: "+91 98765-43210", email: "", designation_id: "role-1" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.email).toBeNull();
      expect(result.value.mobile).toBe("919876543210");
      expect(result.value.designationId).toBe("role-1");
    }
  });
  it.each([
    [{ ...valid, full_name: "A" }, "Full name"],
    [{ ...valid, mobile: "123" }, "Mobile"],
    [{ ...valid, email: "bad" }, "email"],
    [{ ...valid, date_of_join: "today" }, "date"],
    [{ ...valid, location_id: "" }, "location"]
  ])("rejects invalid employee input", (values, message) => {
    const result = parseEmployeeForm(form(values));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(String(message).toLowerCase());
  });
});

describe("parseLeaveRequest", () => {
  it("accepts a valid request", () => {
    expect(parseLeaveRequest(form({ leave_type_id: "annual", start_date: "2026-07-21", end_date: "2026-07-22", reason: "Family event" })).ok).toBe(true);
  });
  it.each([
    [{ leave_type_id: "", start_date: "2026-07-21", end_date: "2026-07-22", reason: "Family" }, "leave type"],
    [{ leave_type_id: "annual", start_date: "bad", end_date: "2026-07-22", reason: "Family" }, "valid leave"],
    [{ leave_type_id: "annual", start_date: "2026-07-21", end_date: "bad", reason: "Family" }, "valid leave"],
    [{ leave_type_id: "annual", start_date: "2026-07-23", end_date: "2026-07-22", reason: "Family" }, "before"],
    [{ leave_type_id: "annual", start_date: "2026-07-21", end_date: "2026-07-22", reason: "x" }, "reason"]
  ])("rejects invalid leave input", (values, message) => {
    const result = parseLeaveRequest(form(values));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(String(message));
  });
});

describe("safeReturnPath", () => {
  it("keeps safe internal paths", () => expect(safeReturnPath("/people?status=active")).toBe("/people?status=active"));
  it("rejects external and protocol-relative paths", () => {
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("//evil.example")).toBe("/");
  });
});
