import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { EmployeeEditWorkspace } from "@/components/employee-edit-workspace";
import { PageHeader } from "@/components/page-header";
import { ProfileReviewPanel } from "@/components/profile-review-panel";
import { StatusPill } from "@/components/status-pill";
import { requireHrmsAuth } from "@/lib/auth";
import { getEmployee, listDesignations, listLocations, loadWorkforceProfileRules } from "@/lib/data";
import { loadEmployeeSalarySettings } from "@/lib/employee-salary";
import { can } from "@/lib/permissions";
import { profileStatusLabel } from "@/lib/workforce-profile";
import { reviewEmployeeProfile, saveEmployeeSalaryConfiguration, updateEmployee } from "./actions";

export const metadata: Metadata = { title: "Employee profile" };
export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="detail"><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function UploadDetail({ label, url }: { label: string; url?: string | null }) {
  return <div className="detail"><dt>{label}</dt><dd>{url ? <span className="inline-actions"><a className="button secondary small" href={url} target="_blank" rel="noreferrer">View</a><a className="button secondary small" href={url} download>Download</a></span> : "—"}</dd></div>;
}

function statutoryLabel(values: string[] | null | undefined) {
  const labels: Record<string, string> = { not_applicable: "Not Applicable", pf: "PF", esi: "ESI" };
  return (values?.length ? values : ["not_applicable"]).map((value) => labels[value] ?? value).join(", ");
}

export default async function EmployeePage({ params, searchParams }: {
  params: { id: string };
  searchParams?: { edit?: string; section?: string; error?: string; notice?: string };
}) {
  const auth = await requireHrmsAuth("people.view");
  const manage = can(auth.permissions, "people.manage");
  const editing = searchParams?.edit === "1" && manage;
  const [employee, locations, designations, salarySettings, rules] = await Promise.all([
    getEmployee(auth, params.id),
    editing ? listLocations(auth) : Promise.resolve([]),
    editing ? listDesignations(auth) : Promise.resolve([]),
    editing ? loadEmployeeSalarySettings(auth, params.id) : Promise.resolve(null),
    editing ? loadWorkforceProfileRules(auth, "employees") : Promise.resolve(null)
  ]);
  if (!employee) notFound();
  const profileStatus = profileStatusLabel(employee.profile_completion_status, employee.is_active);

  return <AppShell auth={auth} active="People">
    <PageHeader eyebrow="Employee profile" title={employee.full_name} description={employee.employee_code ?? "Employee record"} action={<div className="toolbar">{manage && !editing ? <Link className="button primary" href={`/people/${employee.id}?edit=1`}>Edit employee</Link> : null}<Link className="button secondary" href="/people">Back to employees</Link></div>} />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}

    {editing && salarySettings && rules ? <section className="panel employee-form-panel">
      <div className="panel-head">
        <div><h2>Edit employee</h2><p className="panel-subtitle">Maintain employee details, live verification, profile review, and salary configuration.</p></div>
        <Link className="button secondary small" href={`/people/${employee.id}`}>Close</Link>
      </div>
      <div className="panel-body">
        <EmployeeEditWorkspace
          initialSection={searchParams?.section === "salary" ? "salary" : "details"}
          employeeAction={updateEmployee}
          employee={employee}
          locations={locations}
          designations={designations}
          rules={rules}
          salaryAction={saveEmployeeSalaryConfiguration}
          assignment={salarySettings.assignment}
          configurations={salarySettings.configurations}
        />
        {employee.profile_completion_status === "under_review" ? <ProfileReviewPanel action={reviewEmployeeProfile} accountId={employee.id} label="Employee" /> : null}
      </div>
    </section> : null}

    <section className="panel employee-avatar-card">
      <EmployeeAvatar fullName={employee.full_name} photoUrl={employee.profile_photo_url} size="large" />
      <div className="employee-avatar-card-copy">
        <p className="eyebrow">Employee profile</p>
        <h2>{employee.full_name}</h2>
        <p>{employee.employee_code ?? "No employee ID"} · {employee.designations?.name ?? "Designation not assigned"}</p>
        <div className="employee-avatar-card-status"><StatusPill value={profileStatus} /><StatusPill value={employee.is_active ? "active" : "inactive"} /></div>
        {employee.profile_return_remarks ? <p className="profile-return-note">Returned: {employee.profile_return_remarks}</p> : null}
      </div>
    </section>
    <div className="employee-profile-sections">
      <section className="panel"><div className="panel-head"><h2>Employment</h2><StatusPill value={profileStatus} /></div><dl className="panel-body details-grid"><Detail label="Employee ID" value={employee.employee_code} /><Detail label="Biometric ID" value={employee.biometric_id} /><Detail label="Date of joining" value={employee.date_of_join} /><Detail label="Location" value={employee.stations?.station_name ?? employee.stations?.station_code} /><Detail label="Location code" value={employee.stations?.station_code} /><Detail label="Designation" value={employee.designations?.name} /><Detail label="Designation code" value={employee.designations?.code} /><Detail label="Statutory" value={statutoryLabel(employee.statutory_applicability)} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Personal and contact</h2></div><dl className="panel-body details-grid"><Detail label="Mobile" value={`+${employee.mobile_country_code ?? "91"} ${employee.mobile}`} /><Detail label="Email" value={employee.email} /><Detail label="Gender" value={employee.gender} /><Detail label="Date of birth" value={employee.date_of_birth} /><Detail label="Father name" value={employee.father_name} /><Detail label="Blood group" value={employee.blood_group} /><Detail label="Handicapped" value={typeof employee.is_handicapped === "boolean" ? employee.is_handicapped ? "Yes" : "No" : null} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Emergency contact</h2></div><dl className="panel-body details-grid"><Detail label="Contact name" value={employee.emergency_contact_name} /><Detail label="Contact number" value={employee.emergency_contact_number} /><Detail label="Relation" value={employee.emergency_contact_relation} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Identity and address</h2></div><dl className="panel-body details-grid"><Detail label="Aadhaar number" value={employee.aadhaar_number} /><Detail label="PAN number" value={employee.pan_number} /><Detail label="eShram UAN" value={employee.eshram_uan} /><Detail label="Address" value={employee.address} /><Detail label="State" value={employee.state_code} /><Detail label="Postal PIN" value={employee.pincode} /><Detail label="Landmark" value={employee.landmark} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Bank and statutory</h2></div><dl className="panel-body details-grid"><Detail label="Bank account number" value={employee.bank_account_no} /><Detail label="IFSC" value={employee.ifsc} /><Detail label="PF UAN" value={employee.pf_uan} /><Detail label="PF account no" value={employee.pf_account_no} /><Detail label="ESI no" value={employee.esi_no} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Driving and vehicle</h2></div><dl className="panel-body details-grid"><Detail label="Driving licence number" value={employee.driving_license_no} /><Detail label="DL expiry date" value={employee.driving_license_exp_date} /><Detail label="Vehicle registration" value={employee.vehicle_reg_no} /><Detail label="Registration expiry" value={employee.vehicle_reg_exp_date} /><Detail label="Insurance expiry" value={employee.vehicle_insurance_exp_date} /><Detail label="Pollution expiry" value={employee.vehicle_pollution_exp_date} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Documents and profile photo</h2></div><dl className="panel-body details-grid"><UploadDetail label="Aadhaar front" url={employee.upload_urls?.aadhaarFront} /><UploadDetail label="Aadhaar back" url={employee.upload_urls?.aadhaarBack} /><UploadDetail label="PAN upload" url={employee.upload_urls?.pan} /><UploadDetail label="DL front" url={employee.upload_urls?.dlFront} /><UploadDetail label="DL back" url={employee.upload_urls?.dlBack} /><UploadDetail label="Profile photo" url={employee.upload_urls?.profilePhoto} /></dl></section>
    </div>
  </AppShell>;
}
