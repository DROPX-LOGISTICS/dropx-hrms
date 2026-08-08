import "server-only";
import { unstable_cache } from "next/cache";
import { HrmsAuthContext } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isContractorDesignation, isEmployeeDesignation } from "@/lib/employee-options";
import { normalizeProfileFieldRules } from "@/lib/workforce-profile";

export type EmployeeRow = {
  id: string; employee_code: string | null; biometric_id: string | null; full_name: string; mobile: string; mobile_country_code: string | null;
  email: string | null; date_of_join: string; location_id: string | null; designation_id: string | null; statutory_applicability: string[] | null; hr_pay_type?: "monthly" | "package";
  profile_completion_status: string | null; profile_completed_at?: string | null; is_active: boolean; gender?: string | null; date_of_birth?: string | null; father_name?: string | null; blood_group?: string | null;
  aadhaar_number?: string | null; pan_number?: string | null; address?: string | null; state_code?: string | null; pincode?: string | null; landmark?: string | null;
  eshram_uan?: string | null; is_handicapped?: boolean | null; emergency_contact_name?: string | null; emergency_contact_number?: string | null; emergency_contact_relation?: string | null; bank_account_no?: string | null; ifsc?: string | null;
  pf_uan?: string | null; pf_account_no?: string | null; esi_no?: string | null; driving_license_no?: string | null; driving_license_exp_date?: string | null;
  vehicle_reg_no?: string | null; vehicle_reg_exp_date?: string | null; vehicle_insurance_exp_date?: string | null; vehicle_pollution_exp_date?: string | null;
  profile_return_remarks?: string | null; profile_returned_at?: string | null;
  aadhaar_front_path?: string | null; aadhaar_back_path?: string | null; pan_upload_path?: string | null; dl_front_path?: string | null; dl_back_path?: string | null; profile_photo_path: string | null; profile_photo_url: string | null;
  upload_urls?: { aadhaarFront: string | null; aadhaarBack: string | null; pan: string | null; dlFront: string | null; dlBack: string | null; profilePhoto: string | null };
  stations?: { station_code: string; station_name: string | null } | null;
  designations?: { code: string; name: string } | null;
};
export type ContractorRow = {
  id: string; dropx_id: string | null; biometric_id: string | null; full_name: string; mobile: string; mobile_country_code: string | null;
  email: string; date_of_join: string; location_id: string; designation: string | null; statutory_applicability?: string[] | null;
  onboarding_status: string | null; profile_return_remarks?: string | null; profile_returned_at?: string | null; is_active: boolean;
  gender?: string | null; date_of_birth?: string | null; father_name?: string | null; blood_group?: string | null; is_handicapped?: boolean | null;
  aadhaar_number?: string | null; pan_number?: string | null; eshram_uan?: string | null; address?: string | null; state_code?: string | null; postal_pin?: string | null; landmark?: string | null;
  emergency_contact_name?: string | null; emergency_contact_number?: string | null; emergency_contact_relation?: string | null; bank_account_no?: string | null; ifsc_code?: string | null;
  pf_uan?: string | null; pf_account_no?: string | null; esi_no?: string | null; driving_license_no?: string | null; driving_license_exp_date?: string | null;
  vehicle_reg_no?: string | null; vehicle_reg_exp_date?: string | null; vehicle_insurance_exp_date?: string | null; vehicle_pollution_exp_date?: string | null;
  aadhaar_front_path?: string | null; aadhaar_back_path?: string | null; pan_upload_path?: string | null; dl_front_path?: string | null; dl_back_path?: string | null; profile_photo_path: string | null; profile_photo_url: string | null;
  upload_urls?: { aadhaarFront: string | null; aadhaarBack: string | null; pan: string | null; dlFront: string | null; dlBack: string | null; profilePhoto: string | null };
  stations?: { station_code: string; station_name: string | null } | null;
};
export type LocationRow = { id: string; station_code: string; station_name: string | null; location_model_id: string | null };
export type DesignationRow = { id: string; code: string; name: string; model_ids: string[] | null; onboarding_categories: string[] | null };
export type AttendanceRow = { id: string; punch_date: string; in_time: string | null; out_time: string | null; work_minutes: number; punch_count: number; status: string; remark: string | null; employee_id: string | null; location_id: string | null; employees?: { employee_code: string | null; full_name: string } | null; stations?: { station_code: string; station_name: string | null } | null };
export type LeaveTypeRow = { id: string; name: string; code: string; annual_allowance: number; color: string; is_active: boolean };
export type LeaveRequestRow = { id: string; employee_id: string; leave_type_id: string; start_date: string; end_date: string; days: number; reason: string; status: string; requested_at: string; reviewed_at: string | null; reviewer_note: string | null; employees?: { employee_code: string | null; full_name: string; location_id: string | null } | null; hr_leave_types?: { name: string; code: string; color: string } | null };
export type OverviewActivityRow = { id: string; start_date: string; end_date: string; status: string; requested_at: string; employees?: { full_name: string; location_id: string | null } | null; hr_leave_types?: { name: string } | null };

const NO_LOCATION_ACCESS = ["00000000-0000-0000-0000-000000000000"];
export const DEFAULT_PAGE_SIZE = 25;

function normalizePage(page?: number | string) {
  const value = typeof page === "string" ? Number.parseInt(page, 10) : page;
  return Number.isFinite(value) && (value as number) > 0 ? Math.floor(value as number) : 1;
}

function permittedLocationIds(auth: HrmsAuthContext) {
  return auth.locationIds.length ? auth.locationIds : NO_LOCATION_ACCESS;
}

function requireAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase service-role configuration is missing.");
  return admin;
}

const getCachedProfileDocumentUrls = unstable_cache(async (paths: string[]) => {
  if (!paths.length) return [];
  const { data, error } = await requireAdmin().storage
    .from("employee-profile-documents")
    .createSignedUrls(paths, 60 * 60);
  if (error || !data) return [];
  return data.map((item) => ({ path: item.path, signedUrl: item.signedUrl ?? null }));
}, ["hrms-profile-document-urls-v1"], { revalidate: 5 * 60 });

async function withProfilePhotoUrls<T extends { profile_photo_path: string | null }>(rows: T[]) {
  const paths = [...new Set(rows.map((row) => row.profile_photo_path).filter((path): path is string => Boolean(path)))];
  if (!paths.length) return rows.map((row) => ({ ...row, profile_photo_url: null }));
  const data = await getCachedProfileDocumentUrls(paths);
  if (!data.length) return rows.map((row) => ({ ...row, profile_photo_url: null }));
  const signedUrlByPath = new Map(data.map((item) => [item.path, item.signedUrl ?? null]));
  return rows.map((row) => ({
    ...row,
    profile_photo_url: row.profile_photo_path ? signedUrlByPath.get(row.profile_photo_path) ?? null : null
  }));
}

async function withEmployeeDocumentUrls(row: EmployeeRow) {
  const paths = [row.aadhaar_front_path, row.aadhaar_back_path, row.pan_upload_path, row.dl_front_path, row.dl_back_path, row.profile_photo_path]
    .filter((path): path is string => Boolean(path));
  if (!paths.length) return {
    ...row,
    profile_photo_url: null,
    upload_urls: { aadhaarFront: null, aadhaarBack: null, pan: null, dlFront: null, dlBack: null, profilePhoto: null }
  };
  const data = await getCachedProfileDocumentUrls(paths);
  const urls = new Map(data.map((item) => [item.path, item.signedUrl]));
  const signed = (path: string | null | undefined) => path ? urls.get(path) ?? null : null;
  return {
    ...row,
    profile_photo_url: signed(row.profile_photo_path),
    upload_urls: {
      aadhaarFront: signed(row.aadhaar_front_path),
      aadhaarBack: signed(row.aadhaar_back_path),
      pan: signed(row.pan_upload_path),
      dlFront: signed(row.dl_front_path),
      dlBack: signed(row.dl_back_path),
      profilePhoto: signed(row.profile_photo_path)
    }
  };
}

async function withContractorDocumentUrls(row: ContractorRow) {
  const employeeShape = {
    ...row,
    pincode: row.postal_pin,
    ifsc: row.ifsc_code,
    profile_completion_status: row.onboarding_status,
    employee_code: row.dropx_id,
    designation_id: null,
    statutory_applicability: row.statutory_applicability ?? ["not_applicable"],
    profile_completed_at: null,
    designations: null
  } as unknown as EmployeeRow;
  const signed = await withEmployeeDocumentUrls(employeeShape);
  return {
    ...row,
    profile_photo_url: signed.profile_photo_url,
    upload_urls: signed.upload_urls
  };
}

const getCachedLocations = unstable_cache(async (companyId: string) => {
  const { data, error } = await requireAdmin().from("stations").select("id, station_code, station_name, location_model_id").eq("company_id", companyId).eq("is_active", true).or("hide_from_location_list.is.null,hide_from_location_list.eq.false").order("station_code");
  if (error) throw new Error(error.message);
  return (data ?? []) as LocationRow[];
}, ["hrms-location-master-v1"], { revalidate: 30 });

const getCachedDesignations = unstable_cache(async (companyId: string) => {
  const { data, error } = await requireAdmin().from("designations").select("id, code, name, model_ids, onboarding_categories").eq("company_id", companyId).eq("is_active", true).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as DesignationRow[];
}, ["hrms-designation-master-v1"], { revalidate: 30 });

export async function listLocations(auth: HrmsAuthContext) {
  const rows = await getCachedLocations(auth.companyId);
  return auth.allLocations ? rows : rows.filter((row) => auth.locationIds.includes(row.id));
}

export async function listDesignations(auth: HrmsAuthContext) {
  return (await getCachedDesignations(auth.companyId)).filter(isEmployeeDesignation);
}

export async function listContractorDesignations(auth: HrmsAuthContext) {
  return (await getCachedDesignations(auth.companyId)).filter(isContractorDesignation);
}

export async function listEmployees(auth: HrmsAuthContext, filters?: { status?: string; search?: string; location?: string; page?: number | string; pageSize?: number }) {
  const page = normalizePage(filters?.page);
  const pageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE;
  let query = requireAdmin().from("employees").select("id, employee_code, biometric_id, full_name, mobile, mobile_country_code, email, date_of_join, location_id, designation_id, statutory_applicability, hr_pay_type, profile_completion_status, profile_photo_path, is_active, stations(station_code,station_name), designations(code,name)", { count: "exact" }).eq("company_id", auth.companyId).order("created_at", { ascending: false });
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  const status = filters?.status ?? "active";
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (filters?.location) query = query.eq("location_id", filters.location);
  const safeSearch = filters?.search?.replace(/[,()%]/g, " ").trim();
  if (safeSearch) query = query.or(`full_name.ilike.%${safeSearch}%,employee_code.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%`);
  query = query.range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = await withProfilePhotoUrls((data ?? []) as unknown as EmployeeRow[]);
  return { rows, total: count ?? 0, page, pageSize };
}

export type EmployeeOption = { id: string; full_name: string; employee_code: string | null };

export async function listActiveEmployeeOptions(auth: HrmsAuthContext): Promise<EmployeeOption[]> {
  let query = requireAdmin().from("employees").select("id, full_name, employee_code").eq("company_id", auth.companyId).eq("is_active", true).order("full_name");
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEmployee(auth: HrmsAuthContext, employeeId: string) {
  let query = requireAdmin().from("employees").select("id, employee_code, biometric_id, full_name, mobile, mobile_country_code, email, date_of_join, location_id, designation_id, statutory_applicability, hr_pay_type, profile_completion_status, profile_completed_at, profile_return_remarks, profile_returned_at, profile_photo_path, is_active, gender, date_of_birth, father_name, blood_group, is_handicapped, aadhaar_number, pan_number, eshram_uan, address, state_code, pincode, landmark, emergency_contact_name, emergency_contact_number, emergency_contact_relation, bank_account_no, ifsc, pf_uan, pf_account_no, esi_no, driving_license_no, driving_license_exp_date, vehicle_reg_no, vehicle_reg_exp_date, vehicle_insurance_exp_date, vehicle_pollution_exp_date, aadhaar_front_path, aadhaar_back_path, pan_upload_path, dl_front_path, dl_back_path, stations(station_code,station_name), designations(code,name)").eq("company_id", auth.companyId).eq("id", employeeId);
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return withEmployeeDocumentUrls(data as unknown as EmployeeRow);
}

export async function listContractors(auth: HrmsAuthContext, filters?: { status?: string; search?: string; location?: string; page?: number | string; pageSize?: number }) {
  const page = normalizePage(filters?.page);
  const pageSize = filters?.pageSize ?? DEFAULT_PAGE_SIZE;
  let query = requireAdmin()
    .from("contractors")
    .select("id, dropx_id, biometric_id, full_name, mobile, mobile_country_code, email, date_of_join, location_id, designation, onboarding_status, profile_return_remarks, profile_photo_path, is_active, stations(station_code,station_name)", { count: "exact" })
    .eq("company_id", auth.companyId)
    .order("created_at", { ascending: false });
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  if (filters?.status === "inactive") query = query.eq("is_active", false);
  if (filters?.status && !["all", "inactive"].includes(filters.status)) {
    query = query.eq("is_active", true).eq("onboarding_status", filters.status);
  }
  if (filters?.location) query = query.eq("location_id", filters.location);
  const safeSearch = filters?.search?.replace(/[,()%]/g, " ").trim();
  if (safeSearch) query = query.or(`full_name.ilike.%${safeSearch}%,dropx_id.ilike.%${safeSearch}%,mobile.ilike.%${safeSearch}%`);
  query = query.range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  const rows = await withProfilePhotoUrls((data ?? []) as unknown as ContractorRow[]);
  return { rows, total: count ?? 0, page, pageSize };
}

export async function getContractor(auth: HrmsAuthContext, contractorId: string) {
  let query = requireAdmin()
    .from("contractors")
    .select("id, dropx_id, biometric_id, full_name, mobile, mobile_country_code, email, date_of_join, location_id, designation, statutory_applicability, onboarding_status, profile_return_remarks, profile_returned_at, profile_photo_path, is_active, gender, date_of_birth, father_name, blood_group, is_handicapped, aadhaar_number, pan_number, eshram_uan, address, state_code, postal_pin, landmark, emergency_contact_name, emergency_contact_number, emergency_contact_relation, bank_account_no, ifsc_code, pf_uan, pf_account_no, esi_no, driving_license_no, driving_license_exp_date, vehicle_reg_no, vehicle_reg_exp_date, vehicle_insurance_exp_date, vehicle_pollution_exp_date, aadhaar_front_path, aadhaar_back_path, pan_upload_path, dl_front_path, dl_back_path, stations(station_code,station_name)")
    .eq("company_id", auth.companyId)
    .eq("id", contractorId);
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return withContractorDocumentUrls(data as unknown as ContractorRow);
}

const getCachedWorkforceProfileRules = unstable_cache(async (companyId: string, categoryCode: "employees" | "contractors") => {
  const { data, error } = await requireAdmin()
    .from("workforce_categories")
    .select("profile_field_rules")
    .eq("company_id", companyId)
    .eq("code", categoryCode)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    const message = error.message.toLowerCase();
    if (!message.includes("does not exist") && !message.includes("schema cache")) throw new Error(error.message);
  }
  return normalizeProfileFieldRules(data?.profile_field_rules).dashboard;
}, ["hrms-workforce-profile-rules-v1"], { revalidate: 30 });

export async function loadWorkforceProfileRules(auth: HrmsAuthContext, categoryCode: "employees" | "contractors") {
  return getCachedWorkforceProfileRules(auth.companyId, categoryCode);
}

export async function listAttendance(auth: HrmsAuthContext, filters: { date: string; location?: string; page?: number | string; pageSize?: number }) {
  const page = normalizePage(filters.page);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const admin = requireAdmin();
  let query = admin.from("attendance_daily").select("id, punch_date, in_time, out_time, work_minutes, punch_count, status, remark, employee_id, location_id, employees(employee_code,full_name), stations(station_code,station_name)", { count: "exact" }).eq("company_id", auth.companyId).eq("punch_date", filters.date).eq("worker_type", "employee").order("in_time", { ascending: true, nullsFirst: false });
  if (!auth.allLocations) query = query.in("location_id", permittedLocationIds(auth));
  if (filters.location) query = query.eq("location_id", filters.location);
  query = query.range((page - 1) * pageSize, page * pageSize - 1);

  let presentQuery = admin.from("attendance_daily").select("id", { count: "exact", head: true }).eq("company_id", auth.companyId).eq("punch_date", filters.date).eq("worker_type", "employee").eq("status", "P");
  if (!auth.allLocations) presentQuery = presentQuery.in("location_id", permittedLocationIds(auth));
  if (filters.location) presentQuery = presentQuery.eq("location_id", filters.location);

  const [{ data, error, count }, presentResult] = await Promise.all([query, presentQuery]);
  if (error) throw new Error(error.message);
  if (presentResult.error) throw new Error(presentResult.error.message);
  return { rows: (data ?? []) as unknown as AttendanceRow[], total: count ?? 0, present: presentResult.count ?? 0, page, pageSize };
}

const getCachedLeaveTypes = unstable_cache(async (companyId: string, includeInactive: boolean) => {
  let query = requireAdmin().from("hr_leave_types").select("id, name, code, annual_allowance, color, is_active").eq("company_id", companyId).order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaveTypeRow[];
}, ["hrms-leave-types-v1"], { revalidate: 30 });

const getCachedCompanySettings = unstable_cache(async (companyId: string) => {
  const { data, error } = await requireAdmin().from("hr_company_settings").select("work_week, attendance_grace_minutes, full_day_minutes, half_day_minutes, leave_year_start_month").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}, ["hrms-company-settings-v1"], { revalidate: 30 });

export async function listLeaveTypes(auth: HrmsAuthContext, includeInactive = false) {
  return getCachedLeaveTypes(auth.companyId, includeInactive);
}

export async function listLeaveRequests(auth: HrmsAuthContext, status?: string, pagination?: { page?: number | string; pageSize?: number }) {
  const page = normalizePage(pagination?.page);
  const pageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  let query = requireAdmin().from("hr_leave_requests").select("id, employee_id, leave_type_id, start_date, end_date, days, reason, status, requested_at, reviewed_at, reviewer_note, employees!inner(employee_code,full_name,location_id), hr_leave_types(name,code,color)", { count: "exact" }).eq("company_id", auth.companyId).order("requested_at", { ascending: false });
  if (!auth.allLocations) query = query.in("employees.location_id", permittedLocationIds(auth));
  if (status) query = query.eq("status", status);
  query = query.range((page - 1) * pageSize, page * pageSize - 1);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as LeaveRequestRow[], total: count ?? 0, page, pageSize };
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
  return getCachedCompanySettings(auth.companyId);
}
