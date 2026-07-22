"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { COUNTRY_CODE_OPTIONS } from "@/lib/country-codes";
import { EmployeeDesignationOption, EmployeeLocationOption, employeeDesignationsForLocation } from "@/lib/employee-options";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  locations: EmployeeLocationOption[];
  designations: EmployeeDesignationOption[];
};

export function EmployeeForm({ action, locations, designations }: Props) {
  const [locationId, setLocationId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [statutory, setStatutory] = useState<string[]>(["not_applicable"]);
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedSubmissionRef = useRef(false);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const filteredDesignations = useMemo(
    () => employeeDesignationsForLocation(designations, selectedLocation),
    [designations, selectedLocation]
  );

  function toggleStatutory(value: string) {
    if (value === "not_applicable") return setStatutory(["not_applicable"]);
    setStatutory((current) => {
      const withoutNone = current.filter((item) => item !== "not_applicable");
      const next = withoutNone.includes(value) ? withoutNone.filter((item) => item !== value) : [...withoutNone, value];
      return next.length ? next : ["not_applicable"];
    });
  }

  function submitConfirmedRegistration() {
    if (confirmedSubmissionRef.current) return;
    confirmedSubmissionRef.current = true;
    setConfirming(false);
    queueMicrotask(() => formRef.current?.requestSubmit());
  }

  return <form ref={formRef} action={action} onSubmit={(event) => {
    if (!confirmedSubmissionRef.current) {
      event.preventDefault();
      setConfirming(true);
      return;
    }
    confirmedSubmissionRef.current = false;
    setConfirming(false);
  }}>
    <div className="form-grid employee-form-grid">
      <div className="field"><label htmlFor="full_name">Full name *</label><input id="full_name" name="full_name" required /></div>
      <div className="field">
        <label htmlFor="mobile">Mobile number *</label>
        <div className="mobile-field">
          <SearchableSelect id="mobile_country_code" name="mobile_country_code" options={[...COUNTRY_CODE_OPTIONS]} defaultValue="91" placeholder="Country code" required />
          <input id="mobile" name="mobile" inputMode="numeric" required />
        </div>
      </div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" /></div>
      <div className="field"><label htmlFor="date_of_join">Date of joining *</label><input id="date_of_join" name="date_of_join" type="date" required /></div>
      <div className="field">
        <label htmlFor="location_id">Location *</label>
        <SearchableSelect id="location_id" name="location_id" options={locations.map((item) => ({ value: item.id, label: `${item.station_code} · ${item.station_name ?? "Unnamed location"}` }))} value={locationId} placeholder="Search location" required onChange={(next) => { setLocationId(next); setDesignationId(""); }} />
      </div>
      <div className="field">
        <label htmlFor="designation_id">Designation *</label>
        <SearchableSelect id="designation_id" name="designation_id" options={filteredDesignations.map((item) => ({ value: item.id, label: item.name }))} value={designationId} placeholder={locationId ? "Search designation" : "Select location first"} disabled={!locationId} required onChange={setDesignationId} />
        {locationId && filteredDesignations.length === 0 ? <span className="field-help error-text">No employee designations are configured for this location.</span> : null}
      </div>
      <fieldset className="field wide statutory-field">
        <legend>Statutory applicability</legend>
        <div className="tag-select">
          {[{ value: "not_applicable", label: "Not Applicable" }, { value: "pf", label: "PF" }, { value: "esi", label: "ESI" }].map((item) => <button key={item.value} type="button" className={statutory.includes(item.value) ? "selected" : ""} aria-pressed={statutory.includes(item.value)} onClick={() => toggleStatutory(item.value)}>{item.label}</button>)}
        </div>
        {statutory.map((item) => <input key={item} type="hidden" name="statutory_applicability" value={item} />)}
      </fieldset>
      <div className="field wide generated-id-note" role="note">
        Employee ID and Biometric ID will be generated automatically from Dashboard &gt; Settings &gt; ID Generation after you select the location and designation.
      </div>
    </div>
    <div className="form-actions"><Link className="button secondary" href="/people">Cancel</Link><SubmitButton className="button primary" disabled={!locationId || filteredDesignations.length === 0} pendingLabel="Creating employee…">Create employee</SubmitButton></div>
    {confirming ? <div className="modal-backdrop" role="presentation">
      <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="employee-confirm-title">
        <h3 id="employee-confirm-title">Confirm employee registration</h3>
        <p>Do you want to submit this employee registration?</p>
        <div className="form-actions"><button className="button secondary" type="button" onClick={() => setConfirming(false)}>Go back</button><button className="button primary" type="button" onClick={submitConfirmedRegistration}>Yes, submit</button></div>
      </div>
    </div> : null}
  </form>;
}
