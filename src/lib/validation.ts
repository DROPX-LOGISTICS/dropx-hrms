export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function parseEmployeeForm(formData: FormData): ValidationResult<{
  autoGenerateEmployeeCode: boolean;
  employeeCode: string | null;
  fullName: string;
  mobile: string;
  email: string | null;
  dateOfJoin: string;
  locationId: string;
  designationId: string;
  biometricId: string | null;
  mobileCountryCode: string;
  statutoryApplicability: string[];
}> {
  const autoGenerateEmployeeCode = text(formData.get("auto_generate_employee_code")) === "yes";
  const employeeCode = text(formData.get("employee_code")).toUpperCase();
  const fullName = text(formData.get("full_name"));
  const mobile = text(formData.get("mobile")).replace(/\D/g, "");
  const mobileCountryCode = text(formData.get("mobile_country_code")).replace(/\D/g, "") || "91";
  const email = text(formData.get("email")).toLowerCase();
  const dateOfJoin = text(formData.get("date_of_join"));
  const locationId = text(formData.get("location_id"));
  const designationId = text(formData.get("designation_id"));
  const biometricId = text(formData.get("biometric_id"));
  const requestedStatutory = formData.getAll("statutory_applicability").map(text).filter((item) => ["not_applicable", "pf", "esi"].includes(item));
  const statutoryApplicability = requestedStatutory.includes("not_applicable") || requestedStatutory.length === 0
    ? ["not_applicable"]
    : [...new Set(requestedStatutory)];
  if (!autoGenerateEmployeeCode && !/^[A-Z0-9_-]{2,32}$/.test(employeeCode)) return { ok: false, error: "Employee ID must contain 2 to 32 letters, numbers, hyphens or underscores." };
  if (fullName.length < 2) return { ok: false, error: "Full name must contain at least two characters." };
  if (!/^\d{6,15}$/.test(mobile)) return { ok: false, error: "Mobile number must contain 6 to 15 digits." };
  if (!/^\d{1,4}$/.test(mobileCountryCode)) return { ok: false, error: "Select a valid mobile country code." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfJoin)) return { ok: false, error: "Select a valid date of joining." };
  if (!locationId) return { ok: false, error: "Select a work location." };
  if (!designationId) return { ok: false, error: "Select a designation." };
  if (biometricId && !/^\d{1,20}$/.test(biometricId)) return { ok: false, error: "Biometric enrolment ID must contain 1 to 20 digits." };
  return {
    ok: true,
    value: {
      autoGenerateEmployeeCode,
      employeeCode: employeeCode || null,
      fullName,
      mobile,
      email: email || null,
      dateOfJoin,
      locationId,
      designationId,
      biometricId: biometricId || null,
      mobileCountryCode,
      statutoryApplicability
    }
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
