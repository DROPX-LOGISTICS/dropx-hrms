import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { EmployeeEditForm } from "@/components/employee-edit-form";
import { EmployeeSalaryConfigurationForm } from "@/components/employee-salary-configuration-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireHrmsAuth } from "@/lib/auth";
import { getEmployee, listDesignations, listLocations } from "@/lib/data";
import { loadEmployeeSalarySettings } from "@/lib/employee-salary";
import { can } from "@/lib/permissions";
import { saveEmployeeSalaryConfiguration, updateEmployee } from "./actions";

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

export default async function EmployeePage({ params, searchParams }: { params: { id: string }; searchParams?: { edit?: string; error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("people.view");
  const manage = can(auth.permissions, "people.manage");
  const editing = searchParams?.edit === "1" && manage;
  const [employee, locations, designations, salarySettings] = await Promise.all([
    getEmployee(auth, params.id),
    editing ? listLocations(auth) : Promise.resolve([]),
    editing ? listDesignations(auth) : Promise.resolve([]),
    editing ? loadEmployeeSalarySettings(auth, params.id) : Promise.resolve(null)
  ]);
  if (!employee) notFound();

  return <AppShell auth={auth} active="People">
    <PageHeader eyebrow="Employee profile" title={employee.full_name} description={employee.employee_code ?? "Employee record"} action={<div className="toolbar">{manage && !editing ? <Link className="button primary" href={`/people/${employee.id}?edit=1`}>Edit employee</Link> : null}<Link className="button secondary" href="/people">Back to people</Link></div>} />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}
    {editing ? <section className="panel employee-form-panel"><div className="panel-head"><div><h2>Edit employee</h2><p className="panel-subtitle">Maintain the complete employee profile. IDs remain controlled by the Dashboard generation master.</p></div><Link className="button secondary small" href={`/people/${employee.id}`}>Close</Link></div><div className="panel-body"><EmployeeEditForm action={updateEmployee} employee={employee} locations={locations} designations={designations} /></div></section> : null}
    {editing && salarySettings ? <section className="panel employee-form-panel employee-salary-panel">
      <div className="panel-head"><div><h2>Salary settings</h2><p className="panel-subtitle">Configuration assignment and employee-specific payroll values.</p></div></div>
      <div className="panel-body"><EmployeeSalaryConfigurationForm
        action={saveEmployeeSalaryConfiguration}
        assignment={salarySettings.assignment}
        configurations={salarySettings.configurations}
        employeeDateOfJoin={employee.date_of_join}
        employeeId={employee.id}
      /></div>
    </section> : null}
    <section className="panel employee-avatar-card">
      <EmployeeAvatar fullName={employee.full_name} photoUrl={employee.profile_photo_url} size="large" />
      <div className="employee-avatar-card-copy"><p className="eyebrow">Employee profile</p><h2>{employee.full_name}</h2><p>{employee.employee_code ?? "No employee ID"} · {employee.designations?.name ?? "Designation not assigned"}</p><div className="employee-avatar-card-status"><StatusPill value={employee.profile_completion_status ?? "pending"} /><StatusPill value={employee.is_active ? "active" : "inactive"} /></div></div>
    </section>
    <div className="employee-profile-sections">
      <section className="panel"><div className="panel-head"><h2>Employment</h2><StatusPill value={employee.is_active ? "active" : "inactive"} /></div><dl className="panel-body details-grid"><Detail label="Employee ID" value={employee.employee_code} /><Detail label="Biometric ID" value={employee.biometric_id} /><Detail label="Date of joining" value={employee.date_of_join} /><Detail label="Location" value={employee.stations?.station_name ?? employee.stations?.station_code} /><Detail label="Location code" value={employee.stations?.station_code} /><Detail label="Designation" value={employee.designations?.name} /><Detail label="Designation code" value={employee.designations?.code} /><Detail label="Statutory" value={statutoryLabel(employee.statutory_applicability)} /><Detail label="Profile status" value={<StatusPill value={employee.profile_completion_status ?? "pending"} />} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Personal and contact</h2></div><dl className="panel-body details-grid"><Detail label="Mobile" value={`+${employee.mobile_country_code ?? "91"} ${employee.mobile}`} /><Detail label="Email" value={employee.email} /><Detail label="Gender" value={employee.gender} /><Detail label="Date of birth" value={employee.date_of_birth} /><Detail label="Father name" value={employee.father_name} /><Detail label="Blood group" value={employee.blood_group} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Emergency contact</h2></div><dl className="panel-body details-grid"><Detail label="Contact name" value={employee.emergency_contact_name} /><Detail label="Contact number" value={employee.emergency_contact_number} /><Detail label="Relation" value={employee.emergency_contact_relation} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Identity and address</h2></div><dl className="panel-body details-grid"><Detail label="Aadhaar number" value={employee.aadhaar_number} /><Detail label="PAN number" value={employee.pan_number} /><Detail label="Address" value={employee.address} /><Detail label="State" value={employee.state_code} /><Detail label="Postal PIN" value={employee.pincode} /><Detail label="Landmark" value={employee.landmark} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Bank details</h2></div><dl className="panel-body details-grid"><Detail label="Bank account number" value={employee.bank_account_no} /><Detail label="IFSC" value={employee.ifsc} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Documents and profile photo</h2></div><dl className="panel-body details-grid"><UploadDetail label="Aadhaar front" url={employee.upload_urls?.aadhaarFront} /><UploadDetail label="Aadhaar back" url={employee.upload_urls?.aadhaarBack} /><UploadDetail label="PAN upload" url={employee.upload_urls?.pan} /><UploadDetail label="Profile photo" url={employee.upload_urls?.profilePhoto} /></dl></section>
    </div>
  </AppShell>;
}
