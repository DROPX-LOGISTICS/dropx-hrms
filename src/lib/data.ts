import "server-only";
import { HrmsAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isEmployeeDesignation } from "@/lib/employee-options";

export type EmployeeRow = {
  id: string; employee_code: string | null; biometric_id: string | null; full_name: string; mobile: string; mobile_country_code: string | null;
  email: string | null; date_of_join: string; location_id: string | null; designation_id: string | null; statutory_applicability: string[] | null;
  profile_completion_status: string | null; is_active: boolean; gender?: string | null; date_of_birth?: string | null; aadhaar_number?: string | null;
  pan_number?: string | null; bank_account_no?: string | null; ifsc?: string | null; stations?: { station_code: string; station_name: string | null } | null;
  designations?: { code: string; name: string } | null;
};
export type LocationRow = { id: string; station_code: string; station_name: string | null; location_model_id: string | null };
export type DesignationRow = { id: string; code: string; name: string; model_ids: string[] | null; onboarding_categories: string[] | null };
export type AttendanceRow = { id: string; punch_date: string; in_time: string | null; out_time: string | null; work_minutes: number; punch_count: number; status: string; remark: string | null; employee_id: string | null; location_id: string | null; employees?: { employee_code: string | null; full_name: string } | null; stations?: { station_code: string; station_name: string | null } | null };
export type LeaveTypeRow = { id: string; name: string; code: string; annual_allowance: number; color: string; is_active: boolean };
export type LeaveRequestRow = { id: string; employee_id: string; leave_type_id: string; start_date: string; end_date: string; days: number; reason: string; status: string; requested_at: string; reviewed_at: string | null; reviewer_note: string | null; employees?: { employee_code: string | null; full_name: string; location_id: string | null } | null; hr_leave_types?: { name: string; code: string; color: string } | null };
export type OverviewActivityRow = { id: string; start_date: string; end_date: string; status: string; requested_at: string; employees?: { full_name: string; location_id: string | null } | null; hr_leave_types?: { name: string } | null };

const NO_LOCATION_ACCESS = ["00000000-0000-0000-0000-000000000000"];

function permittedLocationIds(auth: HrmsAuthContext) {
  return auth.locationIds.length ? auth.locationIds : NO_LOCATION_ACCESS;
}

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase service-role configuration is missing.");
  return supabaseAdmin;
}

export async function listLocations(auth: HrmsAuthContext) {
  const { data, error } = await requireAdmin().from("stations").select("id, station_code, station_name, location_model_id").eq("company_id", auth.companyId).eq("is_active", true).or("hide_from_location_list.is.null,hide_from_location_list.eq.false").order("station_code");
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as LocationRow[];
  return auth.allLocations ? rows : rows.filter((row) => auth.locationIds.includes(row.id));
}

export async function listDesignations(auth: HrmsAuthContext) {
  const { data, error } = await requireAdmin().from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", auth.companyId).eq("is_active", true).order("name");
  if (error) throw new Error(error.message);
  return ((data ?? []) as DesignationRow[]).filter(isEmployeeDesignation);
}

export async function listEmployees(auth: HrmsAuthContext, filters?: { status?: string; search?: string; location?: string }) {
  let query = requireAdmin().from("employees").select("id, employee_code, biometric_id, full_name, mobile, mobile_country_code, email, date_of_join, location_id, designation_id, statutory_applicability, profile_completion_status, is_active, stations(station_code,station_name), designations(code,name)").eq("company_id", auth.companyId).order("created_at", { ascending: false });
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  if (filters?.status === "active") query = query.eq("is_active", true);
  if (filters?.status === "inactive") query = query.eq("is_active", false);
  if (filters?.location) query = query.eq("location_id", filters.location);
  const safeSearch = filters?.search?.replace(/[,()%]/g, " ").trim();
  if (safeSearch) query = query.or(`full_name.ilike.%${safeSearch}%,employee_code.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EmployeeRow[];
}

export async function getEmployee(auth: HrmsAuthContext, employeeId: string) {
  let query = requireAdmin().from("employees").select("id, employee_code, biometric_id, full_name, mobile, mobile_country_code, email, date_of_join, location_id, designation_id, statutory_applicability, profile_completion_status, is_active, gender, date_of_birth, aadhaar_number, pan_number, bank_account_no, ifsc, stations(station_code,station_name), designations(code,name)").eq("company_id", auth.companyId).eq("id", employeeId);
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as EmployeeRow | null;
}

export async function listAttendance(auth: HrmsAuthContext, filters: { date: string; location?: string }) {
  let query = requireAdmin().from("attendance_daily").select("id, punch_date, in_time, out_time, work_minutes, punch_count, status, remark, employee_id, location_id, employees(employee_code,full_name), stations(station_code,station_name)").eq("company_id", auth.companyId).eq("punch_date", filters.date).eq("worker_type", "employee").order("in_time", { ascending: true, nullsFirst: false });
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  if (filters.location) query = query.eq("location_id", filters.location);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AttendanceRow[];
}

export async function listLeaveTypes(auth: HrmsAuthContext, includeInactive = false) {
  let query = requireAdmin().from("hr_leave_types").select("id, name, code, annual_allowance, color, is_active").eq("company_id", auth.companyId).order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaveTypeRow[];
}

export async function listLeaveRequests(auth: HrmsAuthContext, status?: string) {
  let query = requireAdmin().from("hr_leave_requests").select("id, employee_id, leave_type_id, start_date, end_date, days, reason, status, requested_at, reviewed_at, reviewer_note, employees!inner(employee_code,full_name,location_id), hr_leave_types(name,code,color)").eq("company_id", auth.companyId).order("requested_at", { ascending: false });
  if (!auth.allLocations) query = query.in("employees.location_id", permittedLocationIds(auth));
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as LeaveRequestRow[];
}

export async function loadOverview(auth: HrmsAuthContext) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const admin = requireAdmin();
  let employees = admin.from("employees").select("id", { count: "exact", head: true }).eq("company_id", auth.companyId).eq("is_active", true);
  let attendance = admin.from("attendance_daily").select("id", { count: "exact", head: true }).eq("company_id", auth.companyId).eq("worker_type", "employee").eq("punch_date", today).eq("status", "P");
  let pending = admin.from("hr_leave_requests").select("id, employees!inner(location_id)", { count: "exact", head: true }).eq("company_id", auth.companyId).eq("status", "pending");
  let recent = admin.from("hr_leave_requests").select("id, start_date, end_date, status, requested_at, employees!inner(full_name,location_id), hr_leave_types(name)").eq("company_id", auth.companyId).order("requested_at", { ascending: false }).limit(5);
  if (!auth.allLocations) {
    const locationIds = permittedLocationIds(auth);
    employees = employees.in("location_id", locationIds);
    attendance = attendance.in("location_id", locationIds);
    pending = pending.in("employees.location_id", locationIds);
    recent = recent.in("employees.location_id", locationIds);
  }
  const [employeeResult, attendanceResult, pendingResult, recentResult] = await Promise.all([
    employees,
    attendance,
    pending,
    recent
  ]);
  const firstError = employeeResult.error ?? attendanceResult.error ?? pendingResult.error ?? recentResult.error;
  if (firstError) throw new Error(firstError.message);
  return { today, employees: employeeResult.count ?? 0, present: attendanceResult.count ?? 0, pending: pendingResult.count ?? 0, absent: Math.max((employeeResult.count ?? 0) - (attendanceResult.count ?? 0), 0), recent: (recentResult.data ?? []) as unknown as OverviewActivityRow[] };
}

export async function loadCompanySettings(auth: HrmsAuthContext) {
  const { data, error } = await requireAdmin().from("hr_company_settings").select("work_week, attendance_grace_minutes, full_day_minutes, half_day_minutes, leave_year_start_month").eq("company_id", auth.companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
