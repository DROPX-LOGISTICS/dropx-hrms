import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { EmployeeEditForm } from "@/components/employee-edit-form";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireHrmsAuth } from "@/lib/auth";
import { getEmployee, listDesignations, listLocations } from "@/lib/data";
import { can } from "@/lib/permissions";
import { updateEmployee } from "./actions";

export const metadata: Metadata = { title: "Employee profile" };
export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="detail"><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

export default async function EmployeePage({ params, searchParams }: { params: { id: string }; searchParams?: { edit?: string; error?: string; notice?: string } }) {
  const auth = await requireHrmsAuth("people.view");
  const employee = await getEmployee(auth, params.id);
  if (!employee) notFound();
  const manage = can(auth.permissions, "people.manage");
  const editing = searchParams?.edit === "1" && manage;
  const [locations, designations] = editing ? await Promise.all([listLocations(auth), listDesignations(auth)]) : [[], []];

  return <AppShell auth={auth} active="People">
    <PageHeader eyebrow="Employee profile" title={employee.full_name} description={employee.employee_code ?? "Employee record"} action={<div className="toolbar">{manage && !editing ? <Link className="button primary" href={`/people/${employee.id}?edit=1`}>Edit employee</Link> : null}<Link className="button secondary" href="/people">Back to people</Link></div>} />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}
    {editing ? <section className="panel employee-form-panel"><div className="panel-head"><div><h2>Edit employee</h2><p className="panel-subtitle">Update employment and contact information.</p></div><Link className="button secondary small" href={`/people/${employee.id}`}>Close</Link></div><div className="panel-body"><EmployeeEditForm action={updateEmployee} employee={employee} locations={locations} designations={designations} /></div></section> : null}
    <section className="panel employee-avatar-card">
      <EmployeeAvatar fullName={employee.full_name} photoUrl={employee.profile_photo_url} size="large" />
      <div className="employee-avatar-card-copy">
        <p className="eyebrow">Employee profile</p>
        <h2>{employee.full_name}</h2>
        <p>{employee.employee_code ?? "No employee ID"} · {employee.designations?.name ?? "Designation not assigned"}</p>
        <div className="employee-avatar-card-status"><StatusPill value={employee.profile_completion_status ?? "pending"} /><StatusPill value={employee.is_active ? "active" : "inactive"} /></div>
      </div>
    </section>
    <section className="panel"><div className="panel-head"><h2>Employment</h2><StatusPill value={employee.is_active ? "active" : "inactive"} /></div><dl className="panel-body details-grid"><Detail label="Employee ID" value={employee.employee_code} /><Detail label="Biometric ID" value={employee.biometric_id} /><Detail label="Date of joining" value={employee.date_of_join} /><Detail label="Location" value={employee.stations?.station_name ?? employee.stations?.station_code} /><Detail label="Designation" value={employee.designations?.name} /><Detail label="Profile status" value={<StatusPill value={employee.profile_completion_status ?? "pending"} />} /></dl></section>
    <section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><h2>Personal and statutory</h2></div><dl className="panel-body details-grid"><Detail label="Mobile" value={`+${employee.mobile_country_code ?? "91"} ${employee.mobile}`} /><Detail label="Email" value={employee.email} /><Detail label="Date of birth" value={employee.date_of_birth} /><Detail label="Gender" value={employee.gender} /><Detail label="Aadhaar" value={employee.aadhaar_number} /><Detail label="PAN" value={employee.pan_number} /><Detail label="Bank account" value={employee.bank_account_no} /><Detail label="IFSC" value={employee.ifsc} /><Detail label="Statutory" value={employee.statutory_applicability?.join(", ")} /></dl></section>
  </AppShell>;
}
