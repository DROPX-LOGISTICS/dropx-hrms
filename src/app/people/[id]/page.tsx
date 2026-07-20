import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { requireHrmsAuth } from "@/lib/auth";
import { getEmployee } from "@/lib/data";

export const metadata: Metadata = { title: "Employee profile" };
export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) { return <div className="detail"><dt>{label}</dt><dd>{value || "—"}</dd></div>; }

export default async function EmployeePage({ params }: { params: { id: string } }) {
  const auth = await requireHrmsAuth("people.view");
  const employee = await getEmployee(auth, params.id);
  if (!employee) notFound();
  return <AppShell auth={auth} active="People"><PageHeader eyebrow="Employee profile" title={employee.full_name} description={employee.employee_code ?? "Employee record"} action={<Link className="button secondary" href="/people">Back to people</Link>} /><section className="panel"><div className="panel-head"><h2>Employment</h2><StatusPill value={employee.is_active ? "active" : "inactive"} /></div><dl className="panel-body details-grid"><Detail label="Employee ID" value={employee.employee_code} /><Detail label="Biometric ID" value={employee.biometric_id} /><Detail label="Date of joining" value={employee.date_of_join} /><Detail label="Location" value={employee.stations?.station_name ?? employee.stations?.station_code} /><Detail label="Designation" value={employee.designations?.name} /><Detail label="Profile status" value={<StatusPill value={employee.profile_completion_status ?? "pending"} />} /></dl></section><section className="panel" style={{ marginTop: 18 }}><div className="panel-head"><h2>Personal and statutory</h2></div><dl className="panel-body details-grid"><Detail label="Mobile" value={`+${employee.mobile_country_code ?? "91"} ${employee.mobile}`} /><Detail label="Email" value={employee.email} /><Detail label="Date of birth" value={employee.date_of_birth} /><Detail label="Gender" value={employee.gender} /><Detail label="Aadhaar" value={employee.aadhaar_number} /><Detail label="PAN" value={employee.pan_number} /><Detail label="Bank account" value={employee.bank_account_no} /><Detail label="IFSC" value={employee.ifsc} /><Detail label="Statutory" value={employee.statutory_applicability?.join(", ")} /></dl></section></AppShell>;
}
