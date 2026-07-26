"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import { COUNTRY_CODE_OPTIONS } from "@/lib/country-codes";
import {
  contractorDesignationsForLocation,
  type EmployeeDesignationOption,
  type EmployeeLocationOption
} from "@/lib/employee-options";

export function ContractorForm({ action, locations, designations }: {
  action: (formData: FormData) => void | Promise<void>;
  locations: EmployeeLocationOption[];
  designations: EmployeeDesignationOption[];
}) {
  const [locationId, setLocationId] = useState("");
  const [designation, setDesignation] = useState("");
  const location = locations.find((item) => item.id === locationId);
  const filtered = useMemo(
    () => contractorDesignationsForLocation(designations, location),
    [designations, location]
  );

  return <form action={action}>
    <div className="form-grid employee-form-grid">
      <div className="field"><label htmlFor="contractor_full_name">Full name *</label><input id="contractor_full_name" name="full_name" required /></div>
      <div className="field"><label htmlFor="contractor_mobile">Mobile number *</label><div className="mobile-field"><SearchableSelect id="contractor_mobile_country_code" name="mobile_country_code" options={[...COUNTRY_CODE_OPTIONS]} defaultValue="91" placeholder="Country code" required /><input id="contractor_mobile" name="mobile" inputMode="numeric" required /></div></div>
      <div className="field"><label htmlFor="contractor_email">Email *</label><input id="contractor_email" name="email" type="email" required /></div>
      <div className="field"><label htmlFor="contractor_joining">Date of joining *</label><input id="contractor_joining" name="date_of_join" type="date" required /></div>
      <div className="field"><label htmlFor="contractor_location">Location *</label><SearchableSelect id="contractor_location" name="location_id" options={locations.map((item) => ({ value: item.id, label: `${item.station_code} · ${item.station_name ?? "Unnamed location"}` }))} value={locationId} placeholder="Search location" required onChange={(next) => { setLocationId(next); setDesignation(""); }} /></div>
      <div className="field"><label htmlFor="contractor_designation">Designation *</label><SearchableSelect id="contractor_designation" name="designation" options={filtered.map((item) => ({ value: item.name, label: item.name, helper: item.code }))} value={designation} placeholder={locationId ? "Search contractor designation" : "Select location first"} disabled={!locationId} required onChange={setDesignation} />{locationId && !filtered.length ? <span className="field-help error-text">No contractor designations are configured for this location.</span> : null}</div>
      <div className="field wide generated-id-note" role="note">Contractor ID and Biometric ID are generated automatically from Dashboard &gt; Settings &gt; ID Generation.</div>
    </div>
    <div className="form-actions"><Link className="button secondary" href="/people/contractors">Cancel</Link><SubmitButton className="button primary" disabled={!locationId || !designation || !filtered.length} pendingLabel="Creating contractor…">Create contractor</SubmitButton></div>
  </form>;
}
