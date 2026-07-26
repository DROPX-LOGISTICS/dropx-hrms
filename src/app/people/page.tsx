import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { EmployeeForm } from "@/components/employee-form";
import { EmployeeActionsMenu } from "@/components/employee-actions-menu";
import { PageHeader } from "@/components/page-header";
import { PeopleTypeNav } from "@/components/people-type-nav";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { listDesignations, listEmployees, listLocations } from "@/lib/data";
import { can } from "@/lib/permissions";
import { createEmployee } from "./actions";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({ searchParams }: { searchParams?: { add?: string; error?: string; notice?: string; search?: string; status?: string; location?: string } }) {
  const auth = await requireHrmsAuth("people.view");
  const manage = can(auth.permissions, "people.manage");
  const adding = searchParams?.add === "1" && manage;
  const [employees, locations, designations] = await Promise.all([
    listEmployees(auth, searchParams),
    listLocations(auth),
    adding ? listDesignations(auth) : Promise.resolve([])
  ]);

  return <AppShell auth={auth} active="People">
    <PageHeader eyebrow="Workforce master" title="People" description="Onboard and manage employees and independent contractors in separate registers." action={manage ? <Link className="button primary" href="/people?add=1">Add employee</Link> : undefined} />
    <PeopleTypeNav active="employees" />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}

    {adding ? <section className="panel employee-form-panel">
      <div className="panel-head"><div><h2>Add employee</h2><p className="panel-subtitle">Create an employee record for DropX People.</p></div><Link className="button secondary small" href="/people">Close</Link></div>
      <div className="panel-body"><EmployeeForm action={createEmployee} locations={locations} designations={designations} /></div>
    </section> : null}

    <section className="panel">
      <div className="panel-head">
        <h2>Employee directory</h2>
        <form className="toolbar" method="get">
          <input aria-label="Search employees" name="search" placeholder="Name, ID or mobile" defaultValue={searchParams?.search} />
          <select aria-label="Employee status" name="status" defaultValue={searchParams?.status ?? "active"}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          <select aria-label="Employee location" name="location" defaultValue={searchParams?.location ?? ""}><option value="">All locations</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.station_code}</option>)}</select>
          <SubmitButton className="button secondary small" pendingLabel="Loading…">Apply</SubmitButton><Link className="button secondary small" href="/people">Reset</Link>
        </form>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Contact</th><th>Location</th><th>Designation</th><th>Joined</th><th>Profile</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {employees.length ? employees.map((employee) => <tr key={employee.id}>
          <td><div className="employee-name-cell"><EmployeeAvatar fullName={employee.full_name} photoUrl={employee.profile_photo_url} /><div><strong>{employee.full_name}</strong><div className="muted">{employee.employee_code ?? "No employee ID"}</div></div></div></td>
          <td>{employee.mobile}<div className="muted">{employee.email ?? "—"}</div></td>
          <td>{employee.stations?.station_code ?? "—"}</td><td>{employee.designations?.name ?? "—"}</td><td>{employee.date_of_join}</td>
          <td><StatusPill value={employee.profile_completion_status ?? "pending"} /></td><td><StatusPill value={employee.is_active ? "active" : "inactive"} /></td>
          <td><EmployeeActionsMenu employeeId={employee.id} employeeName={employee.full_name} canEdit={manage} /></td>
        </tr>) : <tr><td className="empty-cell" colSpan={8}>No employees match these filters.</td></tr>}
      </tbody></table></div>
    </section>
  </AppShell>;
}
