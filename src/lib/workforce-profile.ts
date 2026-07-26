export type WorkforceProfileType = "employee" | "contractor";

export type ProfileFieldRuleSet = {
  enabled: string[];
  required: string[];
};

export type ProfileFieldChannelRules = {
  dropx_one: ProfileFieldRuleSet;
  dashboard: ProfileFieldRuleSet;
};

export const workforceProfileFieldKeys = [
  "gender",
  "date_of_birth",
  "aadhaar_number",
  "pan_number",
  "eshram_uan",
  "father_name",
  "blood_group",
  "is_handicapped",
  "address",
  "state_code",
  "pincode",
  "landmark",
  "bank_account_no",
  "ifsc",
  "pf_uan",
  "pf_account_no",
  "esi_no",
  "driving_license_no",
  "driving_license_exp_date",
  "vehicle_reg_no",
  "vehicle_reg_exp_date",
  "vehicle_insurance_exp_date",
  "vehicle_pollution_exp_date",
  "emergency_contact_number",
  "emergency_contact_name",
  "emergency_contact_relation",
  "aadhaar_front",
  "aadhaar_back",
  "pan_upload",
  "dl_front",
  "dl_back",
  "profile_photo"
] as const;

function normalizeRuleSet(value: unknown, defaults: string[]): ProfileFieldRuleSet {
  const valid = new Set<string>(workforceProfileFieldKeys);
  const record = value && typeof value === "object"
    ? value as { enabled?: unknown; required?: unknown }
    : {};
  const enabled = Array.isArray(record.enabled)
    ? record.enabled.map(String).filter((key) => valid.has(key))
    : defaults;
  const enabledSet = new Set(enabled);
  const required = Array.isArray(record.required)
    ? record.required.map(String).filter((key) => enabledSet.has(key))
    : [];
  return { enabled, required };
}

export function normalizeProfileFieldRules(value: unknown): ProfileFieldChannelRules {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const defaults = [...workforceProfileFieldKeys];
  if (!("dropx_one" in record) && !("dashboard" in record)) {
    const legacy = normalizeRuleSet(value, defaults.filter((key) => key !== "pf_account_no"));
    return {
      dropx_one: legacy,
      dashboard: normalizeRuleSet(value, defaults)
    };
  }
  return {
    dropx_one: normalizeRuleSet(record.dropx_one, defaults.filter((key) => key !== "pf_account_no")),
    dashboard: normalizeRuleSet(record.dashboard, defaults)
  };
}

export function profileStatusLabel(value: string | null | undefined, isActive = true) {
  if (!isActive) return "Inactive";
  const normalized = String(value ?? "pending").trim().toLowerCase();
  if (normalized === "under_review" || normalized === "submitted") return "Under review";
  if (normalized === "returned" || normalized === "rejected") return "Returned";
  if (normalized === "active") return "Active";
  return "Pending";
}

export function profilePayloadForRules(
  payload: Record<string, unknown>,
  rules: ProfileFieldRuleSet,
  aliases: Record<string, string> = {}
) {
  const enabled = new Set(rules.enabled.map((key) => aliases[key] ?? key));
  return Object.fromEntries(Object.entries(payload).filter(([key]) => enabled.has(key)));
}

export function missingRequiredProfileFields(
  values: Record<string, unknown>,
  rules: ProfileFieldRuleSet,
  statutoryApplicability: string[]
) {
  return rules.required.filter((key) => {
    if ((key === "pf_uan" || key === "pf_account_no") && !statutoryApplicability.includes("pf")) return false;
    if (key === "esi_no" && !statutoryApplicability.includes("esi")) return false;
    return !String(values[key] ?? "").trim();
  });
}
