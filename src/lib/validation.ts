export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function parseEmployeeForm(formData: FormData): ValidationResult<{
  fullName: string;
  mobile: string;
  email: string | null;
  dateOfJoin: string;
  locationId: string;
  designationId: string;
  mobileCountryCode: string;
  statutoryApplicability: string[];
  hrPayType: "monthly" | "package";
}> {
  const fullName = text(formData.get("full_name"));
  const mobile = text(formData.get("mobile")).replace(/\D/g, "");
  const mobileCountryCode = text(formData.get("mobile_country_code")).replace(/\D/g, "") || "91";
  const email = text(formData.get("email")).toLowerCase();
  const dateOfJoin = text(formData.get("date_of_join"));
  const locationId = text(formData.get("location_id"));
  const designationId = text(formData.get("designation_id"));
  const requestedStatutory = formData.getAll("statutory_applicability").map(text).filter((item) => ["not_applicable", "pf", "esi"].includes(item));
  const statutoryApplicability = requestedStatutory.includes("not_applicable") || requestedStatutory.length === 0
    ? ["not_applicable"]
    : [...new Set(requestedStatutory)];
  const hrPayType = text(formData.get("hr_pay_type")) === "package" ? "package" : "monthly";
  if (fullName.length < 2) return { ok: false, error: "Full name must contain at least two characters." };
  if (!/^\d{6,15}$/.test(mobile)) return { ok: false, error: "Mobile number must contain 6 to 15 digits." };
  if (!/^\d{1,4}$/.test(mobileCountryCode)) return { ok: false, error: "Select a valid mobile country code." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfJoin)) return { ok: false, error: "Select a valid date of joining." };
  if (!locationId) return { ok: false, error: "Select a work location." };
  if (!designationId) return { ok: false, error: "Select a designation." };
  return {
    ok: true,
    value: {
      fullName,
      mobile,
      email: email || null,
      dateOfJoin,
      locationId,
      designationId,
      mobileCountryCode,
      statutoryApplicability,
      hrPayType
    }
  };
}

export function parseContractorForm(formData: FormData): ValidationResult<{
  fullName: string;
  mobile: string;
  email: string;
  dateOfJoin: string;
  locationId: string;
  designation: string;
  mobileCountryCode: string;
}> {
  const fullName = text(formData.get("full_name"));
  const mobile = text(formData.get("mobile")).replace(/\D/g, "");
  const mobileCountryCode = text(formData.get("mobile_country_code")).replace(/\D/g, "") || "91";
  const email = text(formData.get("email")).toLowerCase();
  const dateOfJoin = text(formData.get("date_of_join"));
  const locationId = text(formData.get("location_id"));
  const designation = text(formData.get("designation"));
  if (fullName.length < 2) return { ok: false, error: "Full name must contain at least two characters." };
  if (!/^\d{6,15}$/.test(mobile)) return { ok: false, error: "Mobile number must contain 6 to 15 digits." };
  if (!/^\d{1,4}$/.test(mobileCountryCode)) return { ok: false, error: "Select a valid mobile country code." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfJoin) || Number.isNaN(Date.parse(dateOfJoin))) {
    return { ok: false, error: "Select a valid date of joining." };
  }
  if (!locationId) return { ok: false, error: "Select a work location." };
  if (!designation) return { ok: false, error: "Select a designation." };
  return {
    ok: true,
    value: { fullName, mobile, email, dateOfJoin, locationId, designation, mobileCountryCode }
  };
}

export function parseLeaveRequest(formData: FormData): ValidationResult<{
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
}> {
  const leaveTypeId = text(formData.get("leave_type_id"));
  const startDate = text(formData.get("start_date"));
  const endDate = text(formData.get("end_date"));
  const reason = text(formData.get("reason"));
  if (!leaveTypeId) return { ok: false, error: "Select a leave type." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return { ok: false, error: "Select a valid leave period." };
  if (endDate < startDate) return { ok: false, error: "End date cannot be before start date." };
  if (reason.length < 3) return { ok: false, error: "Add a short reason for the request." };
  return { ok: true, value: { leaveTypeId, startDate, endDate, reason } };
}

export function safeReturnPath(value: FormDataEntryValue | null, fallback = "/") {
  const candidate = text(value);
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  const parsed = new URL(candidate, "https://hrms.dropxlogistics.com");
  return `${parsed.pathname}${parsed.search}`;
}
