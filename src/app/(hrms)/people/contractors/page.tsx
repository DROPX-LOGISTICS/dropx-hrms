import type { Metadata } from "next";
import Link from "next/link";
import { ContractorForm } from "@/components/contractor-form";
import { EmployeeActionsMenu } from "@/components/employee-actions-menu";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { PeopleTypeNav } from "@/components/people-type-nav";
import { StatusPill } from "@/components/status-pill";
import { SubmitButton } from "@/components/submit-button";
import { requireHrmsAuth } from "@/lib/auth";
import { listContractorDesignations, listContractors, listLocations } from "@/lib/data";
import { can } from "@/lib/permissions";
import { profileStatusLabel } from "@/lib/workforce-profile";
import { createContractor } from "./actions";

export const metadata: Metadata = { title: "Independent Contractors" };
export default async function ContractorsPage({ searchParams }: {
  searchParams?: { add?: string; error?: string; notice?: string; search?: string; status?: string; location?: string; page?: string };
}) {
  const auth = await requireHrmsAuth("people.view");
  const manage = can(auth.permissions, "people.manage");
  const adding = searchParams?.add === "1" && manage;
  const [{ rows: contractors, total, page, pageSize }, locations, designations] = await Promise.all([
    listContractors(auth, searchParams),
    listLocations(auth),
    adding ? listContractorDesignations(auth) : Promise.resolve([])
  ]);

  return <>
    <PageHeader eyebrow="Workforce master" title="Independent Contractors" description="Onboard and review independent contractors separately from employees." action={manage ? <Link className="button primary" href="/people/contractors?add=1">Add contractor</Link> : undefined} />
    <PeopleTypeNav active="contractors" />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}

    {adding ? <section className="panel employee-form-panel">
      <div className="panel-head"><div><h2>Add independent contractor</h2><p className="panel-subtitle">Create a contractor account using the Dashboard master settings.</p></div><Link className="button secondary small" href="/people/contractors">Close</Link></div>
      <div className="panel-body"><ContractorForm action={createContractor} locations={locations} designations={designations} /></div>
    </section> : null}

    <section className="panel">
      <div className="panel-head">
        <h2>Independent Contractor directory</h2>
        <form className="toolbar" method="get">
          <input aria-label="Search contractors" name="search" placeholder="Name, ID or mobile" defaultValue={searchParams?.search} />
          <select aria-label="Contractor profile status" name="status" defaultValue={searchParams?.status ?? "all"}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="returned">Returned</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select aria-label="Contractor location" name="location" defaultValue={searchParams?.location ?? ""}><option value="">All locations</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.station_code}</option>)}</select>
          <SubmitButton className="button secondary small" pendingLabel="Loading…">Apply</SubmitButton>
          <Link className="button secondary small" href="/people/contractors">Reset</Link>
        </form>
      </div>
      <div className="table-wrap"><table><thead><tr><th>Contractor</th><th>Contact</th><th>Location</th><th>Designation</th><th>Joined</th><th>Profile</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {contractors.length ? contractors.map((contractor) => <tr key={contractor.id}>
          <td><div className="employee-name-cell"><EmployeeAvatar fullName={contractor.full_name} photoUrl={contractor.profile_photo_url} /><div><strong>{contractor.full_name}</strong><div className="muted">{contractor.dropx_id ?? "No contractor ID"}</div></div></div></td>
          <td>+{contractor.mobile_country_code ?? "91"} {contractor.mobile}<div className="muted">{contractor.email}</div></td>
          <td>{contractor.stations?.station_code ?? "—"}</td>
          <td>{contractor.designation ?? "—"}</td>
          <td>{contractor.date_of_join}</td>
          <td><StatusPill value={profileStatusLabel(contractor.onboarding_status, contractor.is_active)} /></td>
          <td><StatusPill value={contractor.is_active ? "active" : "inactive"} /></td>
          <td><EmployeeActionsMenu basePath="/people/contractors" employeeId={contractor.id} employeeName={contractor.full_name} canEdit={manage} /></td>
        </tr>) : <tr><td className="empty-cell" colSpan={8}>No independent contractors match these filters.</td></tr>}
      </tbody></table></div>
      <Pagination page={page} pageSize={pageSize} total={total} basePath="/people/contractors" searchParams={searchParams} />
    </section>
  </>;
}
