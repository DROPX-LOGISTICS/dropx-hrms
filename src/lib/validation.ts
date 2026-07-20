export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export function parseEmployeeForm(formData: FormData): ValidationResult<{
  employeeCode: string | null;
  fullName: string;
  mobile: string;
  email: string | null;
  dateOfJoin: string;
  locationId: string;
  designationId: string | null;
  biometricId: string | null;
}> {
  const fullName = text(formData.get("full_name"));
  const mobile = text(formData.get("mobile")).replace(/\D/g, "");
  const email = text(formData.get("email")).toLowerCase();
  const dateOfJoin = text(formData.get("date_of_join"));
  const locationId = text(formData.get("location_id"));
  if (fullName.length < 2) return { ok: false, error: "Full name must contain at least two characters." };
  if (!/^\d{6,15}$/.test(mobile)) return { ok: false, error: "Mobile number must contain 6 to 15 digits." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfJoin)) return { ok: false, error: "Select a valid date of joining." };
  if (!locationId) return { ok: false, error: "Select a work location." };
  return {
    ok: true,
    value: {
      employeeCode: text(formData.get("employee_code")) || null,
      fullName,
      mobile,
      email: email || null,
      dateOfJoin,
      locationId,
      designationId: text(formData.get("designation_id")) || null,
      biometricId: text(formData.get("biometric_id")) || null
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
