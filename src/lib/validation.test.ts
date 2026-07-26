import { describe, expect, it } from "vitest";
import { parseContractorForm, parseEmployeeForm, parseLeaveRequest, safeReturnPath } from "./validation";

function form(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

describe("parseEmployeeForm", () => {
  const valid = { full_name: "Asha Nair", mobile: "9876543210", mobile_country_code: "91", email: "asha@example.com", date_of_join: "2026-07-20", location_id: "station-1", designation_id: "role-1" };
  it("normalizes valid employee input", () => {
    const result = parseEmployeeForm(form(valid));
    expect(result).toEqual({ ok: true, value: { fullName: "Asha Nair", mobile: "9876543210", mobileCountryCode: "91", email: "asha@example.com", dateOfJoin: "2026-07-20", locationId: "station-1", designationId: "role-1", statutoryApplicability: ["not_applicable"] } });
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
  it("ignores submitted identifiers and keeps IDs master-controlled", () => {
    const data = form({ ...valid, employee_code: "MANUAL-1", biometric_id: "999", statutory_applicability: "pf" });
    data.append("statutory_applicability", "esi");
    const result = parseEmployeeForm(data);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).not.toHaveProperty("employeeCode");
      expect(result.value).not.toHaveProperty("biometricId");
      expect(result.value.statutoryApplicability).toEqual(["pf", "esi"]);
    }
  });
  it.each([
    [{ ...valid, full_name: "A" }, "Full name"],
    [{ ...valid, mobile: "123" }, "Mobile"],
    [{ ...valid, email: "bad" }, "email"],
    [{ ...valid, date_of_join: "today" }, "date"],
    [{ ...valid, location_id: "" }, "location"],
    [{ ...valid, designation_id: "" }, "designation"]
  ])("rejects invalid employee input", (values, message) => {
    const result = parseEmployeeForm(form(values));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(String(message).toLowerCase());
  });
});

describe("parseContractorForm", () => {
  const valid = { full_name: "Ravi Kumar", mobile: "9876543210", mobile_country_code: "91", email: "ravi@example.com", date_of_join: "2026-07-20", location_id: "station-1", designation: "Line Haul Contractor" };

  it("normalizes a valid independent contractor", () => {
    expect(parseContractorForm(form(valid))).toEqual({
      ok: true,
      value: {
        fullName: "Ravi Kumar",
        mobile: "9876543210",
        mobileCountryCode: "91",
        email: "ravi@example.com",
        dateOfJoin: "2026-07-20",
        locationId: "station-1",
        designation: "Line Haul Contractor"
      }
    });
  });

  it.each([
    [{ ...valid, full_name: "R" }, "Full name"],
    [{ ...valid, mobile: "123" }, "Mobile"],
    [{ ...valid, email: "" }, "email"],
    [{ ...valid, date_of_join: "today" }, "date"],
    [{ ...valid, location_id: "" }, "location"],
    [{ ...valid, designation: "" }, "designation"]
  ])("rejects invalid contractor input", (values, message) => {
    const result = parseContractorForm(form(values));
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
