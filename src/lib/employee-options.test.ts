import { describe, expect, it } from "vitest";
import { contractorDesignationsForLocation, employeeDesignationsForLocation, isContractorDesignation, isEmployeeDesignation } from "./employee-options";

const location = { id: "station-1", station_code: "KAL", station_name: "Kalady", location_model_id: "model-a" };
const employee = { id: "role-1", code: "HR", name: "HR Manager", model_ids: ["model-a"], onboarding_categories: ["employees"] };

describe("employee designation filtering", () => {
  it("returns only employee designations matching the selected location model", () => {
    const rows = employeeDesignationsForLocation([
      employee,
      { ...employee, id: "role-2", model_ids: ["model-b"] },
      { ...employee, id: "role-3", onboarding_categories: ["field_executives"] },
      { ...employee, id: "role-4", onboarding_categories: ["delivery_executives"] }
    ], location);
    expect(rows.map((row) => row.id)).toEqual(["role-1"]);
  });

  it("keeps unscoped employee designations available at every location", () => {
    expect(employeeDesignationsForLocation([{ ...employee, model_ids: [] }], location)).toHaveLength(1);
  });

  it("returns no designations before a location is selected", () => {
    expect(employeeDesignationsForLocation([employee], undefined)).toEqual([]);
  });

  it("keeps legacy uncategorized designations employee-compatible", () => {
    expect(isEmployeeDesignation({ ...employee, onboarding_categories: null })).toBe(true);
  });
});

describe("contractor designation filtering", () => {
  const contractor = { ...employee, id: "contractor-role", onboarding_categories: ["contractors"] };

  it("returns only contractor designations matching the location model", () => {
    const rows = contractorDesignationsForLocation([
      contractor,
      { ...contractor, id: "wrong-model", model_ids: ["model-b"] },
      employee,
      { ...contractor, id: "vendor", onboarding_categories: ["vendors"] }
    ], location);
    expect(rows.map((row) => row.id)).toEqual(["contractor-role"]);
  });

  it("does not treat uncategorized or employee designations as contractors", () => {
    expect(isContractorDesignation({ ...contractor, onboarding_categories: null })).toBe(false);
    expect(isContractorDesignation(employee)).toBe(false);
  });
});
