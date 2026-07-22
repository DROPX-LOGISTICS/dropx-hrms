"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { COUNTRY_CODE_OPTIONS } from "@/lib/country-codes";
import { EmployeeDesignationOption, EmployeeLocationOption, employeeDesignationsForLocation } from "@/lib/employee-options";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";

type EditableEmployee = {
  id: string;
  employee_code: string | null;
  biometric_id: string | null;
  full_name: string;
  mobile_country_code: string | null;
  mobile: string;
  email: string | null;
  date_of_join: string;
  location_id: string | null;
  designation_id: string | null;
  statutory_applicability: string[] | null;
};

export function EmployeeEditForm({ action, employee, locations, designations }: {
  action: (formData: FormData) => void | Promise<void>;
  employee: EditableEmployee;
  locations: EmployeeLocationOption[];
  designations: EmployeeDesignationOption[];
}) {
  const [locationId, setLocationId] = useState(employee.location_id ?? "");
  const [designationId, setDesignationId] = useState(employee.designation_id ?? "");
  const [statutory, setStatutory] = useState<string[]>(employee.statutory_applicability?.length ? employee.statutory_applicability : ["not_applicable"]);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const filteredDesignations = useMemo(() => employeeDesignationsForLocation(designations, selectedLocation), [designations, selectedLocation]);

  function toggleStatutory(value: string) {
    if (value === "not_applicable") return setStatutory(["not_applicable"]);
    setStatutory((current) => {
      const withoutNone = current.filter((item) => item !== "not_applicable");
      const next = withoutNone.includes(value) ? withoutNone.filter((item) => item !== value) : [...withoutNone, value];
      return next.length ? next : ["not_applicable"];
    });
  }

  return <form action={action}>
    <input type="hidden" name="employee_id" value={employee.id} />
    <div className="form-grid employee-form-grid">
      <div className="field"><label htmlFor="edit_employee_code">Employee ID *</label><input id="edit_employee_code" name="employee_code" defaultValue={employee.employee_code ?? ""} required /></div>
      <div className="field"><label htmlFor="edit_full_name">Full name *</label><input id="edit_full_name" name="full_name" defaultValue={employee.full_name} required /></div>
      <div className="field"><label htmlFor="edit_biometric_id">Biometric enrolment ID</label><input id="edit_biometric_id" name="biometric_id" defaultValue={employee.biometric_id ?? ""} inputMode="numeric" pattern="[0-9]{1,20}" placeholder="Generated from ID Generation master if blank" /></div>
      <div className="field">
        <label htmlFor="edit_mobile">Mobile number *</label>
        <div className="mobile-field"><SearchableSelect id="edit_mobile_country_code" name="mobile_country_code" options={[...COUNTRY_CODE_OPTIONS]} defaultValue={employee.mobile_country_code ?? "91"} placeholder="Country code" required /><input id="edit_mobile" name="mobile" defaultValue={employee.mobile} inputMode="numeric" required /></div>
      </div>
      <div className="field"><label htmlFor="edit_email">Email</label><input id="edit_email" name="email" type="email" defaultValue={employee.email ?? ""} /></div>
      <div className="field"><label htmlFor="edit_date_of_join">Date of joining *</label><input id="edit_date_of_join" name="date_of_join" type="date" defaultValue={employee.date_of_join} required /></div>
      <div className="field">
        <label htmlFor="edit_location_id">Location *</label>
        <SearchableSelect id="edit_location_id" name="location_id" options={locations.map((item) => ({ value: item.id, label: `${item.station_code} · ${item.station_name ?? "Unnamed location"}` }))} value={locationId} placeholder="Search location" required onChange={(next) => { setLocationId(next); setDesignationId(""); }} />
      </div>
      <div className="field">
        <label htmlFor="edit_designation_id">Designation *</label>
        <SearchableSelect id="edit_designation_id" name="designation_id" options={filteredDesignations.map((item) => ({ value: item.id, label: item.name }))} value={designationId} placeholder={locationId ? "Search designation" : "Select location first"} disabled={!locationId} required onChange={setDesignationId} />
        {locationId && filteredDesignations.length === 0 ? <span className="field-help error-text">No employee designations are configured for this location.</span> : null}
      </div>
      <fieldset className="field wide statutory-field">
        <legend>Statutory applicability</legend>
        <div className="tag-select">{[{ value: "not_applicable", label: "Not Applicable" }, { value: "pf", label: "PF" }, { value: "esi", label: "ESI" }].map((item) => <button key={item.value} type="button" className={statutory.includes(item.value) ? "selected" : ""} aria-pressed={statutory.includes(item.value)} onClick={() => toggleStatutory(item.value)}>{item.label}</button>)}</div>
        {statutory.map((item) => <input key={item} type="hidden" name="statutory_applicability" value={item} />)}
      </fieldset>
    </div>
    <div className="form-actions"><Link className="button secondary" href={`/people/${employee.id}`}>Cancel</Link><SubmitButton className="button primary" disabled={!locationId || !designationId || filteredDesignations.length === 0} pendingLabel="Saving changes…">Save changes</SubmitButton></div>
  </form>;
}
