"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProfileVerificationPanel } from "@/components/profile-verification-panel";
import { SearchableSelect } from "@/components/searchable-select";
import { SubmitButton } from "@/components/submit-button";
import { COUNTRY_CODE_OPTIONS } from "@/lib/country-codes";
import type { ContractorRow } from "@/lib/data";
import {
  contractorDesignationsForLocation,
  type EmployeeDesignationOption,
  type EmployeeLocationOption
} from "@/lib/employee-options";
import type { ProfileFieldRuleSet } from "@/lib/workforce-profile";

const genderOptions = ["Male", "Female", "Other"].map((value) => ({ value, label: value }));
const bloodGroupOptions = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((value) => ({ value, label: value }));
const stateOptions = ["AP", "AR", "AS", "BR", "CG", "GA", "GJ", "HR", "HP", "JH", "KA", "KL", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "WB", "AN", "CH", "DN", "DL", "JK", "LA", "LD", "PY"].map((value) => ({ value, label: value }));
const yesNoOptions = [{ value: "false", label: "No" }, { value: "true", label: "Yes" }];
const statusOptions = [{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }];

function ExistingDocument({ label, url }: { label: string; url?: string | null }) {
  return <span className="field-help">{url ? <a href={url} target="_blank" rel="noreferrer">View current {label}</a> : `No ${label} uploaded`}</span>;
}

export function ContractorEditForm({ action, contractor, locations, designations, rules }: {
  action: (formData: FormData) => void | Promise<void>;
  contractor: ContractorRow;
  locations: EmployeeLocationOption[];
  designations: EmployeeDesignationOption[];
  rules: ProfileFieldRuleSet;
}) {
  const [locationId, setLocationId] = useState(contractor.location_id);
  const [designation, setDesignation] = useState(contractor.designation ?? "");
  const [statutory, setStatutory] = useState(contractor.statutory_applicability?.length ? contractor.statutory_applicability : ["not_applicable"]);
  const location = locations.find((item) => item.id === locationId);
  const filtered = useMemo(() => contractorDesignationsForLocation(designations, location), [designations, location]);
  const effective = designation && !filtered.some((item) => item.name === designation)
    ? [...designations.filter((item) => item.name === designation), ...filtered]
    : filtered;
  const enabled = (key: string) => rules.enabled.includes(key);
  const required = (key: string) => rules.required.includes(key);

  function toggleStatutory(value: string) {
    if (value === "not_applicable") return setStatutory(["not_applicable"]);
    setStatutory((current) => {
      const withoutNone = current.filter((item) => item !== "not_applicable");
      const next = withoutNone.includes(value) ? withoutNone.filter((item) => item !== value) : [...withoutNone, value];
      return next.length ? next : ["not_applicable"];
    });
  }

  return <form action={action}>
    <input name="contractor_id" type="hidden" value={contractor.id} />
    <div className="generated-id-summary">
      <div><span>Contractor ID</span><strong>{contractor.dropx_id ?? "Generated on save"}</strong></div>
      <div><span>Biometric ID</span><strong>{contractor.biometric_id ?? "Generated on save"}</strong></div>
      <p>Identifiers are read-only and managed by Dashboard &gt; Settings &gt; ID Generation.</p>
    </div>
    <div className="form-grid employee-form-grid">
      <h3 className="wide form-section-title">Engagement</h3>
      <div className="field"><label htmlFor="edit_contractor_name">Full name *</label><input id="edit_contractor_name" name="full_name" defaultValue={contractor.full_name} required /></div>
      <div className="field"><label htmlFor="edit_contractor_joining">Date of joining *</label><input id="edit_contractor_joining" name="date_of_join" type="date" defaultValue={contractor.date_of_join} required /></div>
      <div className="field"><label htmlFor="edit_contractor_status">Status</label><SearchableSelect id="edit_contractor_status" name="is_active" options={statusOptions} defaultValue={contractor.is_active ? "true" : "false"} placeholder="Search status" required /></div>
      <div className="field"><label htmlFor="edit_contractor_location">Location *</label><SearchableSelect id="edit_contractor_location" name="location_id" options={locations.map((item) => ({ value: item.id, label: `${item.station_code} · ${item.station_name ?? "Unnamed location"}` }))} value={locationId} placeholder="Search location" required onChange={(next) => { setLocationId(next); setDesignation(""); }} /></div>
      <div className="field"><label htmlFor="edit_contractor_designation">Designation *</label><SearchableSelect id="edit_contractor_designation" name="designation" options={effective.map((item) => ({ value: item.name, label: item.name, helper: item.code }))} value={designation} placeholder={locationId ? "Search contractor designation" : "Select location first"} disabled={!locationId} required onChange={setDesignation} /></div>
      <fieldset className="field wide statutory-field"><legend>Statutory applicability</legend><div className="tag-select">{[{ value: "not_applicable", label: "Not Applicable" }, { value: "pf", label: "PF" }, { value: "esi", label: "ESI" }].map((item) => <button key={item.value} type="button" className={statutory.includes(item.value) ? "selected" : ""} aria-pressed={statutory.includes(item.value)} onClick={() => toggleStatutory(item.value)}>{item.label}</button>)}</div>{statutory.map((item) => <input key={item} type="hidden" name="statutory_applicability" value={item} />)}</fieldset>

      <h3 className="wide form-section-title">Personal and contact</h3>
      <div className="field"><label htmlFor="edit_contractor_mobile">Mobile number *</label><div className="mobile-field"><SearchableSelect id="edit_contractor_country" name="mobile_country_code" options={[...COUNTRY_CODE_OPTIONS]} defaultValue={contractor.mobile_country_code ?? "91"} placeholder="Country code" required /><input id="edit_contractor_mobile" name="mobile" defaultValue={contractor.mobile} inputMode="numeric" required /></div></div>
      <div className="field"><label htmlFor="edit_contractor_email">Email *</label><input id="edit_contractor_email" name="email" type="email" defaultValue={contractor.email} required /></div>
      {enabled("gender") ? <div className="field"><label htmlFor="edit_contractor_gender">Gender</label><SearchableSelect id="edit_contractor_gender" name="gender" options={genderOptions} defaultValue={contractor.gender ?? undefined} placeholder="Search gender" /></div> : null}
      {enabled("date_of_birth") ? <div className="field"><label htmlFor="edit_contractor_dob">Date of birth</label><input id="edit_contractor_dob" name="date_of_birth" type="date" defaultValue={contractor.date_of_birth ?? ""} required={required("date_of_birth")} /></div> : null}
      {enabled("father_name") ? <div className="field"><label htmlFor="edit_contractor_father">Father name</label><input id="edit_contractor_father" name="father_name" defaultValue={contractor.father_name ?? ""} required={required("father_name")} /></div> : null}
      {enabled("blood_group") ? <div className="field"><label htmlFor="edit_contractor_blood">Blood group</label><SearchableSelect id="edit_contractor_blood" name="blood_group" options={bloodGroupOptions} defaultValue={contractor.blood_group ?? undefined} placeholder="Search blood group" /></div> : null}
      {enabled("is_handicapped") ? <div className="field"><label htmlFor="edit_contractor_handicapped">Handicapped</label><SearchableSelect id="edit_contractor_handicapped" name="is_handicapped" options={yesNoOptions} defaultValue={typeof contractor.is_handicapped === "boolean" ? String(contractor.is_handicapped) : undefined} placeholder="Select" /></div> : null}

      <h3 className="wide form-section-title">Identity and address</h3>
      {enabled("aadhaar_number") ? <div className="field"><label htmlFor="edit_contractor_aadhaar">Aadhaar number</label><input id="edit_contractor_aadhaar" name="aadhaar_number" defaultValue={contractor.aadhaar_number ?? ""} inputMode="numeric" maxLength={12} pattern="[0-9]{12}" required={required("aadhaar_number")} /></div> : null}
      {enabled("pan_number") ? <div className="field"><label htmlFor="edit_contractor_pan">PAN number</label><input id="edit_contractor_pan" name="pan_number" defaultValue={contractor.pan_number ?? ""} pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]" required={required("pan_number")} /><ProfileVerificationPanel accountId={contractor.id} kind="pan" profileType="contractor" /></div> : null}
      {enabled("eshram_uan") ? <div className="field"><label htmlFor="edit_contractor_eshram">eShram UAN</label><input id="edit_contractor_eshram" name="eshram_uan" defaultValue={contractor.eshram_uan ?? ""} inputMode="numeric" maxLength={12} pattern="[0-9]{12}" required={required("eshram_uan")} /></div> : null}
      {enabled("address") ? <div className="field wide"><label htmlFor="edit_contractor_address">Address</label><input id="edit_contractor_address" name="address" defaultValue={contractor.address ?? ""} required={required("address")} /></div> : null}
      {enabled("state_code") ? <div className="field"><label htmlFor="edit_contractor_state">State</label><SearchableSelect id="edit_contractor_state" name="state_code" options={stateOptions} defaultValue={contractor.state_code ?? undefined} placeholder="Search state" /></div> : null}
      {enabled("pincode") ? <div className="field"><label htmlFor="edit_contractor_pin">Postal PIN</label><input id="edit_contractor_pin" name="postal_pin" defaultValue={contractor.postal_pin ?? ""} inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required={required("pincode")} /></div> : null}
      {enabled("landmark") ? <div className="field"><label htmlFor="edit_contractor_landmark">Landmark</label><input id="edit_contractor_landmark" name="landmark" defaultValue={contractor.landmark ?? ""} required={required("landmark")} /></div> : null}

      <h3 className="wide form-section-title">Bank and statutory details</h3>
      {enabled("bank_account_no") ? <div className="field"><label htmlFor="edit_contractor_bank">Bank account number</label><input id="edit_contractor_bank" name="bank_account_no" defaultValue={contractor.bank_account_no ?? ""} pattern="[A-Za-z0-9]*" required={required("bank_account_no")} /></div> : null}
      {enabled("ifsc") ? <div className="field"><label htmlFor="edit_contractor_ifsc">IFSC</label><input id="edit_contractor_ifsc" name="ifsc_code" defaultValue={contractor.ifsc_code ?? ""} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" required={required("ifsc")} /><ProfileVerificationPanel accountId={contractor.id} kind="bank" profileType="contractor" /></div> : null}
      {enabled("pf_uan") ? <div className="field"><label htmlFor="edit_contractor_pf">PF UAN</label><input id="edit_contractor_pf" name="pf_uan" defaultValue={contractor.pf_uan ?? ""} inputMode="numeric" maxLength={12} pattern="[0-9]{12}" required={required("pf_uan")} /><ProfileVerificationPanel accountId={contractor.id} kind="pf_uan" profileType="contractor" /></div> : null}
      {enabled("pf_account_no") ? <div className="field"><label htmlFor="edit_contractor_pf_account">PF Account No</label><input id="edit_contractor_pf_account" name="pf_account_no" defaultValue={contractor.pf_account_no ?? ""} pattern="[A-Za-z0-9]*" required={required("pf_account_no")} /></div> : null}
      {enabled("esi_no") ? <div className="field"><label htmlFor="edit_contractor_esi">ESI No</label><input id="edit_contractor_esi" name="esi_no" defaultValue={contractor.esi_no ?? ""} pattern="[A-Za-z0-9]*" required={required("esi_no")} /></div> : null}

      <h3 className="wide form-section-title">Emergency contact</h3>
      {enabled("emergency_contact_name") ? <div className="field"><label htmlFor="edit_contractor_emergency_name">Contact name</label><input id="edit_contractor_emergency_name" name="emergency_contact_name" defaultValue={contractor.emergency_contact_name ?? ""} required={required("emergency_contact_name")} /></div> : null}
      {enabled("emergency_contact_number") ? <div className="field"><label htmlFor="edit_contractor_emergency_number">Contact number</label><input id="edit_contractor_emergency_number" name="emergency_contact_number" defaultValue={contractor.emergency_contact_number ?? ""} inputMode="numeric" maxLength={10} pattern="[0-9]{10}" required={required("emergency_contact_number")} /></div> : null}
      {enabled("emergency_contact_relation") ? <div className="field"><label htmlFor="edit_contractor_emergency_relation">Relation</label><input id="edit_contractor_emergency_relation" name="emergency_contact_relation" defaultValue={contractor.emergency_contact_relation ?? ""} required={required("emergency_contact_relation")} /></div> : null}

      <h3 className="wide form-section-title">Driving and vehicle</h3>
      {enabled("driving_license_no") ? <div className="field"><label htmlFor="edit_contractor_dl">Driving licence number</label><input id="edit_contractor_dl" name="driving_license_no" defaultValue={contractor.driving_license_no ?? ""} required={required("driving_license_no")} /><ProfileVerificationPanel accountId={contractor.id} kind="dl" profileType="contractor" /></div> : null}
      {enabled("driving_license_exp_date") ? <div className="field"><label htmlFor="edit_contractor_dl_expiry">DL expiry date</label><input id="edit_contractor_dl_expiry" name="driving_license_exp_date" type="date" defaultValue={contractor.driving_license_exp_date ?? ""} required={required("driving_license_exp_date")} /></div> : null}
      {enabled("vehicle_reg_no") ? <div className="field"><label htmlFor="edit_contractor_vehicle">Vehicle registration number</label><input id="edit_contractor_vehicle" name="vehicle_reg_no" defaultValue={contractor.vehicle_reg_no ?? ""} required={required("vehicle_reg_no")} /><ProfileVerificationPanel accountId={contractor.id} kind="vehicle" profileType="contractor" /></div> : null}
      {enabled("vehicle_reg_exp_date") ? <div className="field"><label htmlFor="edit_contractor_vehicle_expiry">Vehicle registration expiry</label><input id="edit_contractor_vehicle_expiry" name="vehicle_reg_exp_date" type="date" defaultValue={contractor.vehicle_reg_exp_date ?? ""} required={required("vehicle_reg_exp_date")} /></div> : null}
      {enabled("vehicle_insurance_exp_date") ? <div className="field"><label htmlFor="edit_contractor_insurance">Vehicle insurance expiry</label><input id="edit_contractor_insurance" name="vehicle_insurance_exp_date" type="date" defaultValue={contractor.vehicle_insurance_exp_date ?? ""} required={required("vehicle_insurance_exp_date")} /></div> : null}
      {enabled("vehicle_pollution_exp_date") ? <div className="field"><label htmlFor="edit_contractor_pollution">Pollution expiry</label><input id="edit_contractor_pollution" name="vehicle_pollution_exp_date" type="date" defaultValue={contractor.vehicle_pollution_exp_date ?? ""} required={required("vehicle_pollution_exp_date")} /></div> : null}

      <h3 className="wide form-section-title">Documents and profile photo</h3>
      {enabled("aadhaar_front") ? <div className="field"><label htmlFor="edit_contractor_aadhaar_front">Aadhaar front</label><input id="edit_contractor_aadhaar_front" name="aadhaar_front_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="Aadhaar front" url={contractor.upload_urls?.aadhaarFront} /></div> : null}
      {enabled("aadhaar_back") ? <div className="field"><label htmlFor="edit_contractor_aadhaar_back">Aadhaar back</label><input id="edit_contractor_aadhaar_back" name="aadhaar_back_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="Aadhaar back" url={contractor.upload_urls?.aadhaarBack} /></div> : null}
      {enabled("pan_upload") ? <div className="field"><label htmlFor="edit_contractor_pan_upload">PAN upload</label><input id="edit_contractor_pan_upload" name="pan_upload_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="PAN" url={contractor.upload_urls?.pan} /></div> : null}
      {enabled("dl_front") ? <div className="field"><label htmlFor="edit_contractor_dl_front">DL front</label><input id="edit_contractor_dl_front" name="dl_front_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="DL front" url={contractor.upload_urls?.dlFront} /></div> : null}
      {enabled("dl_back") ? <div className="field"><label htmlFor="edit_contractor_dl_back">DL back</label><input id="edit_contractor_dl_back" name="dl_back_file" type="file" accept="image/*,.pdf" /><ExistingDocument label="DL back" url={contractor.upload_urls?.dlBack} /></div> : null}
      {enabled("profile_photo") ? <div className="field"><label htmlFor="edit_contractor_photo">Profile photo</label><input id="edit_contractor_photo" name="profile_photo_file" type="file" accept="image/*" /><ExistingDocument label="profile photo" url={contractor.upload_urls?.profilePhoto} /></div> : null}
    </div>
    <div className="form-actions"><Link className="button secondary" href={`/people/contractors/${contractor.id}`}>Cancel</Link><SubmitButton className="button primary" disabled={!locationId || !designation || !effective.length} pendingLabel="Saving contractor…">Save changes</SubmitButton></div>
  </form>;
}
