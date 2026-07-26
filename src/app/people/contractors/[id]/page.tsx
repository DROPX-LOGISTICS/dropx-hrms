import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContractorEditForm } from "@/components/contractor-edit-form";
import { EmployeeAvatar } from "@/components/employee-avatar";
import { PageHeader } from "@/components/page-header";
import { ProfileReviewPanel } from "@/components/profile-review-panel";
import { StatusPill } from "@/components/status-pill";
import { requireHrmsAuth } from "@/lib/auth";
import { getContractor, listContractorDesignations, listLocations, loadWorkforceProfileRules } from "@/lib/data";
import { can } from "@/lib/permissions";
import { profileStatusLabel } from "@/lib/workforce-profile";
import { reviewContractorProfile, updateContractor } from "./actions";

export const metadata: Metadata = { title: "Independent Contractor profile" };
export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="detail"><dt>{label}</dt><dd>{value || "—"}</dd></div>;
}

function UploadDetail({ label, url }: { label: string; url?: string | null }) {
  return <div className="detail"><dt>{label}</dt><dd>{url ? <span className="inline-actions"><a className="button secondary small" href={url} target="_blank" rel="noreferrer">View</a><a className="button secondary small" href={url} download>Download</a></span> : "—"}</dd></div>;
}

export default async function ContractorPage({ params, searchParams }: {
  params: { id: string };
  searchParams?: { edit?: string; error?: string; notice?: string };
}) {
  const auth = await requireHrmsAuth("people.view");
  const manage = can(auth.permissions, "people.manage");
  const editing = searchParams?.edit === "1" && manage;
  const [contractor, locations, designations, rules] = await Promise.all([
    getContractor(auth, params.id),
    editing ? listLocations(auth) : Promise.resolve([]),
    editing ? listContractorDesignations(auth) : Promise.resolve([]),
    editing ? loadWorkforceProfileRules(auth, "contractors") : Promise.resolve(null)
  ]);
  if (!contractor) notFound();
  const profileStatus = profileStatusLabel(contractor.onboarding_status, contractor.is_active);

  return <AppShell auth={auth} active="People">
    <PageHeader eyebrow="Independent Contractor profile" title={contractor.full_name} description={contractor.dropx_id ?? "Contractor record"} action={<div className="toolbar">{manage && !editing ? <Link className="button primary" href={`/people/contractors/${contractor.id}?edit=1`}>Edit contractor</Link> : null}<Link className="button secondary" href="/people/contractors">Back to contractors</Link></div>} />
    {searchParams?.error ? <div className="alert error" role="alert">{searchParams.error}</div> : null}
    {searchParams?.notice ? <div className="alert success" role="status">{searchParams.notice}</div> : null}

    {editing && rules ? <section className="panel employee-form-panel">
      <div className="panel-head"><div><h2>Edit independent contractor</h2><p className="panel-subtitle">Maintain profile details, verify identity data, and review submitted accounts.</p></div><Link className="button secondary small" href={`/people/contractors/${contractor.id}`}>Close</Link></div>
      <div className="panel-body">
        <ContractorEditForm action={updateContractor} contractor={contractor} locations={locations} designations={designations} rules={rules} />
        {contractor.onboarding_status === "under_review" ? <ProfileReviewPanel action={reviewContractorProfile} accountId={contractor.id} label="Independent Contractor" /> : null}
      </div>
    </section> : null}

    <section className="panel employee-avatar-card">
      <EmployeeAvatar fullName={contractor.full_name} photoUrl={contractor.profile_photo_url} size="large" />
      <div className="employee-avatar-card-copy"><p className="eyebrow">Independent Contractor</p><h2>{contractor.full_name}</h2><p>{contractor.dropx_id ?? "No contractor ID"} · {contractor.designation ?? "Designation not assigned"}</p><div className="employee-avatar-card-status"><StatusPill value={profileStatus} /><StatusPill value={contractor.is_active ? "active" : "inactive"} /></div>{contractor.profile_return_remarks ? <p className="profile-return-note">Returned: {contractor.profile_return_remarks}</p> : null}</div>
    </section>
    <div className="employee-profile-sections">
      <section className="panel"><div className="panel-head"><h2>Engagement</h2><StatusPill value={profileStatus} /></div><dl className="panel-body details-grid"><Detail label="Contractor ID" value={contractor.dropx_id} /><Detail label="Biometric ID" value={contractor.biometric_id} /><Detail label="Date of joining" value={contractor.date_of_join} /><Detail label="Location" value={contractor.stations?.station_name ?? contractor.stations?.station_code} /><Detail label="Location code" value={contractor.stations?.station_code} /><Detail label="Designation" value={contractor.designation} /><Detail label="Statutory" value={(contractor.statutory_applicability ?? ["not_applicable"]).join(", ")} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Personal and contact</h2></div><dl className="panel-body details-grid"><Detail label="Mobile" value={`+${contractor.mobile_country_code ?? "91"} ${contractor.mobile}`} /><Detail label="Email" value={contractor.email} /><Detail label="Gender" value={contractor.gender} /><Detail label="Date of birth" value={contractor.date_of_birth} /><Detail label="Father name" value={contractor.father_name} /><Detail label="Blood group" value={contractor.blood_group} /><Detail label="Handicapped" value={typeof contractor.is_handicapped === "boolean" ? contractor.is_handicapped ? "Yes" : "No" : null} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Identity and address</h2></div><dl className="panel-body details-grid"><Detail label="Aadhaar number" value={contractor.aadhaar_number} /><Detail label="PAN number" value={contractor.pan_number} /><Detail label="eShram UAN" value={contractor.eshram_uan} /><Detail label="Address" value={contractor.address} /><Detail label="State" value={contractor.state_code} /><Detail label="Postal PIN" value={contractor.postal_pin} /><Detail label="Landmark" value={contractor.landmark} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Bank and statutory</h2></div><dl className="panel-body details-grid"><Detail label="Bank account number" value={contractor.bank_account_no} /><Detail label="IFSC" value={contractor.ifsc_code} /><Detail label="PF UAN" value={contractor.pf_uan} /><Detail label="PF Account No" value={contractor.pf_account_no} /><Detail label="ESI No" value={contractor.esi_no} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Emergency contact</h2></div><dl className="panel-body details-grid"><Detail label="Contact name" value={contractor.emergency_contact_name} /><Detail label="Contact number" value={contractor.emergency_contact_number} /><Detail label="Relation" value={contractor.emergency_contact_relation} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Driving and vehicle</h2></div><dl className="panel-body details-grid"><Detail label="Driving licence number" value={contractor.driving_license_no} /><Detail label="DL expiry date" value={contractor.driving_license_exp_date} /><Detail label="Vehicle registration" value={contractor.vehicle_reg_no} /><Detail label="Registration expiry" value={contractor.vehicle_reg_exp_date} /><Detail label="Insurance expiry" value={contractor.vehicle_insurance_exp_date} /><Detail label="Pollution expiry" value={contractor.vehicle_pollution_exp_date} /></dl></section>
      <section className="panel"><div className="panel-head"><h2>Documents and profile photo</h2></div><dl className="panel-body details-grid"><UploadDetail label="Aadhaar front" url={contractor.upload_urls?.aadhaarFront} /><UploadDetail label="Aadhaar back" url={contractor.upload_urls?.aadhaarBack} /><UploadDetail label="PAN upload" url={contractor.upload_urls?.pan} /><UploadDetail label="DL front" url={contractor.upload_urls?.dlFront} /><UploadDetail label="DL back" url={contractor.upload_urls?.dlBack} /><UploadDetail label="Profile photo" url={contractor.upload_urls?.profilePhoto} /></dl></section>
    </div>
  </AppShell>;
}
