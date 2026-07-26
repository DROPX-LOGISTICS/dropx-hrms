import { describe, expect, it } from "vitest";
import { missingRequiredProfileFields, normalizeProfileFieldRules, profilePayloadForRules, profileStatusLabel, workforceProfileFieldKeys } from "./workforce-profile";

describe("workforce profile rules", () => {
  it("uses all supported fields when no master configuration exists", () => {
    const result = normalizeProfileFieldRules(null);
    expect(result.dashboard.enabled).toEqual([...workforceProfileFieldKeys]);
  });

  it("drops unknown and disabled required fields", () => {
    const result = normalizeProfileFieldRules({
      dashboard: { enabled: ["pan_number", "unknown"], required: ["pan_number", "aadhaar_number"] }
    });
    expect(result.dashboard).toEqual({ enabled: ["pan_number"], required: ["pan_number"] });
  });

  it("maps review statuses to readable labels", () => {
    expect(profileStatusLabel("under_review")).toBe("Under review");
    expect(profileStatusLabel("returned")).toBe("Returned");
    expect(profileStatusLabel("active", false)).toBe("Inactive");
  });

  it("filters writes to enabled master fields and supports schema aliases", () => {
    expect(profilePayloadForRules(
      { pan_number: "ABCDE1234F", postal_pin: "673001", vehicle_reg_no: "KL10A1" },
      { enabled: ["pan_number", "pincode"], required: [] },
      { pincode: "postal_pin" }
    )).toEqual({ pan_number: "ABCDE1234F", postal_pin: "673001" });
  });

  it("enforces statutory fields only when their statutory scheme is selected", () => {
    const rules = { enabled: ["pf_uan", "esi_no"], required: ["pf_uan", "esi_no"] };
    expect(missingRequiredProfileFields({}, rules, ["not_applicable"])).toEqual([]);
    expect(missingRequiredProfileFields({}, rules, ["pf"])).toEqual(["pf_uan"]);
  });
});
