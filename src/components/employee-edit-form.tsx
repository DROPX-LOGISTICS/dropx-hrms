"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import { COUNTRY_CODE_OPTIONS } from "@/lib/country-codes";
import { EmployeeDesignationOption, EmployeeLocationOption, employeeDesignationsForLocation } from "@/lib/employee-options";

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
  gender?: string | null;
  date_of_birth?: string | null;
  father_name?: string | null;
  blood_group?: string | null;
  aadhaar_number?: string | null;
  pan_number?: string | null;
  address?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  landmark?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_number?: string | null;
  emergency_contact_relation?: string | null;
  bank_account_no?: string | null;
  ifsc?: string | null;
  is_active: boolean;
  upload_urls?: { aadhaarFront: string | null; aadhaarBack: string | null; pan: string | null; profilePhoto: string | null };
};

const genderOptions = ["Male", "Female", "Other"].map((value) => ({ value, label: value }));
const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => ({ value, label: value }));
const stateOptions = ["AP", "AR", "AS", "BR", "CG", "GA", "GJ", "HR", "HP", "JH", "KA", "KL", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB", "AN", "CH", "DN", "DL", "JK", "LA", "LD", "PY"].map((value) => ({ value, label: value }));
const statusOptions = [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }];

function ExistingDocument({ label, url }: { label: string; url?: string | null }) {
  return <span className="field-help">{url ? <a href={url} target="_blank" rel="noreferrer">View current {label}</a> : `No ${label} uploaded`}</span>;
}

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
  const effectiveDesignations = designationId && !filteredDesignations.some((item) => item.id === designationId)
    ? [...designations.filter((item) => item.id === designationId), ...filteredDesignations]
    : filteredDesignations;

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
    <div className="generated-id-summary">
      <div><span>Employee ID</span><strong>{employee.employee_code ?? "Generated on save"}</strong></div>
      <div><span>Biometric ID</span><strong>{employee.biometric_id ?? "Generated on save"}</strong></div>
      <p>Identifiers are read-only and managed by Dashboard &gt; Settings &gt; ID Generation.</p>
    </div>
    <div className="form-grid employee-form-grid">
      <h3 className="wide form-section-title">Employment</h3>
      <div className="field"><label htmlFor="edit_full_name">Full name *</label><input id="edit_full_name" name="full_name" defaultValue={employee.full_name} required /></div>
      <div className="field"><label htmlFor="edit_date_of_join">Date of joining *</label><input id="edit_date_of_join" name="date_of_join" type="date" defaultValue={employee.date_of_join} required /></div>
      <div className="field"><label htmlFor="edit_status">Status</label><SearchableSelect id="edit_status" name="is_active" options={statusOptions} defaultValue={employee.is_active ? "true" : "false"} placeholder="Search status" required /></div>
      <div className="field"><label htmlFor="edit_location_id">Location *</label><SearchableSelect id="edit_location_id" name="location_id" options={locations.map((item) => ({ value: item.id, label: `${item.station_code} · ${item.station_name ?? "Unnamed location"}` }))} value={locationId} placeholder="Search location" required onChange={(next) => { setLocationId(next); setDesignationId(""); }} /></div>
      <div className="field"><label htmlFor="edit_designation_id">Designation *</label><SearchableSelect id="edit_designation_id" name="designation_id" options={effectiveDesignations.map((item) => ({ value: item.id, label: item.name }))} value={designationId} placeholder={locationId ? "Search designation" : "Select location first"} disabled={!locationId} required onChange={setDesignationId} /></div>
      <fieldset className="field wide statutory-field"><legend>Statutory applicability</legend><div className="tag-select">{[{ value: "not_applicable", label: "Not Applicable" }, { value: "pf", label: "PF" }, { value: "esi", label: "ESI" }].map((item) => <button key={item.value} type="button" className={statutory.includes(item.value) ? "selected" : ""} aria-pressed={statutory.includes(item.value)} onClick={() => toggleStatutory(item.value)}>{item.label}</button>)}</div>{statutory.map((item) => <input key={item} type="hidden" name="statutory_applicability" value={item} />)}</fieldset>

      <h3 className="wide form-section-title">Personal and contact</h3>
      <div className="field"><label htmlFor="edit_mobile">Mobile number *</label><div className="mobile-field"><SearchableSelect id="edit_mobile_country_code" name="mobile_country_code" options={[...COUNTRY_CODE_OPTIONS]} defaultValue={employee.mobile_country_code ?? "91"} placeholder="Country code" required /><input id="edit_mobile" name="mobile" defaultValue={employee.mobile} inputMode="numeric" required /></div></div>
      <div className="field"><label htmlFor="edit_email">Email</label><input id="edit_email" name="email" type="email" defaultValue={employee.email ?? ""} /></div>
      <div className="field"><label htmlFor="edit_gender">Gender</label><SearchableSelect id="edit_gender" name="gender" options={genderOptions} defaultValue={employee.gender ?? undefined} placeholder="Search gender" /></div>
      <div className="field"><label htmlFor="edit_date_of_birth">Date of birth</label><input id="edit_date_of_birth" name="date_of_birth" type="date" defaultValue={employee.date_of_birth ?? ""} /></div>
      <div className="field"><label htmlFor="edit_father_name">Father name</label><input id="edit_father_name" name="father_name" defaultValue={employee.father_name ?? ""} /></div>
      <div className="field"><label htmlFor="edit_blood_group">Blood group</label><SearchableSelect id="edit_blood_group" name="blood_group" options={bloodGroupOptions} defaultValue={employee.blood_group ?? undefined} placeholder="Search blood group" /></div>

      <h3 className="wide form-section-title">Identity and address</h3>
      <div className="field"><label htmlFor="edit_aadhaar">Aadhaar number</label><input id="edit_aadhaar" name="aadhaar_number" defaultValue={employee.aadhaar_number ?? ""} inputMode="numeric" maxLength={12} pattern="[0-9]{12}" /></div>
      <div className="field"><label htmlFor="edit_pan">PAN number</label><input id="edit_pan" name="pan_number" defaultValue={employee.pan_number ?? ""} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" /></div>
      <div className="field wide"><label htmlFor="edit_address">Address</label><input id="edit_address" name="address" defaultValue={employee.address ?? ""} /></div>
      <div className="field"><label htmlFor="edit_state">State</label><SearchableSelect id="edit_state" name="state_code" options={stateOptions} defaultValue={employee.state_code ?? undefined} placeholder="Search state" /></div>
      <div className="field"><label htmlFor="edit_pincode">Postal PIN</label><input id="edit_pincode" name="pincode" defaultValue={employee.pincode ?? ""} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" /></div>
      <div className="field"><label htmlFor="edit_landmark">Landmark</label><input id="edit_landmark" name="landmark" defaultValue={employee.landmark ?? ""} /></div>

      <h3 className="wide form-section-title">Emergency contact</h3>
      <div className="field"><label htmlFor="edit_emergency_name">Contact name</label><input id="edit_emergency_name" name="emergency_contact_name" defaultValue={employee.emergency_contact_name ?? ""} /></div>
      <div className="field"><label htmlFor="edit_emergency_number">Contact number</label><input id="edit_emergency_number" name="emergency_contact_number" defaultValue={employee.emergency_contact_number ?? ""} inputMode="numeric" maxLength={10} pattern="[0-9]{10}" /></div>
      <div className="field"><label htmlFor="edit_emergency_relation">Relation</label><input id="edit_emergency_relation" name="emergency_contact_relation" defaultValue={employee.emergency_contact_relation ?? ""} /></div>

      <h3 className="wide form-section-title">Bank details</h3>
      <div className="field"><label htmlFor="edit_bank_account">Bank account number</label><input id="edit_bank_account" name="bank_account_no" defaultValue={employee.bank_account_no ?? ""} inputMode="numeric" /></div>
      <div className="field"><label htmlFor="edit_ifsc">IFSC</label><input id="edit_ifsc" name="ifsc" defaultValue={employee.ifsc ?? ""} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" /></div>

      <h3 className="wide form-section-title">Documents and profile photo</h3>
      <div className="field"><label htmlFor="edit_aadhaar_front">Aadhaar front</label><input id="edit_aadhaar_front" name="aadhaar_front_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="Aadhaar front" url={employee.upload_urls?.aadhaarFront} /></div>
      <div className="field"><label htmlFor="edit_aadhaar_back">Aadhaar back</label><input id="edit_aadhaar_back" name="aadhaar_back_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="Aadhaar back" url={employee.upload_urls?.aadhaarBack} /></div>
      <div className="field"><label htmlFor="edit_pan_upload">PAN upload</label><input id="edit_pan_upload" name="pan_upload_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="PAN" url={employee.upload_urls?.pan} /></div>
      <div className="field"><label htmlFor="edit_profile_photo">Profile photo</label><input id="edit_profile_photo" name="profile_photo_file" type="file" accept="image/*" /><ExistingDocument label="profile photo" url={employee.upload_urls?.profilePhoto} /></div>
    </div>
    <div className="form-actions"><Link className="button secondary" href={`/people/${employee.id}`}>Cancel</Link><SubmitButton className="button primary" disabled={!locationId || !designationId || effectiveDesignations.length === 0} pendingLabel="Saving changes…">Save changes</SubmitButton></div>
  </form>;
}
