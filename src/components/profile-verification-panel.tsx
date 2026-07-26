"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VerificationKind } from "@/lib/profile-verifications";
import type { WorkforceProfileType } from "@/lib/workforce-profile";

type VerificationResult = {
  kind: VerificationKind;
  inputKey?: string;
  verified?: boolean;
  manualReview?: boolean;
  blockSubmit?: boolean;
  name?: string;
  accountName?: string;
  ownerName?: string;
  fuelType?: string;
  message?: string;
  warning?: string;
  expiryDate?: string;
  registrationExpiryDate?: string;
  insuranceExpiryDate?: string;
  pollutionExpiryDate?: string;
};

const labels: Record<VerificationKind, string> = {
  pan: "PAN",
  pan_aadhaar: "PAN Aadhaar",
  dl: "DL",
  vehicle: "Vehicle",
  bank: "Bank",
  pf_uan: "PF UAN"
};

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function inputKey(parts: string[]) {
  return parts.map((part) => part.trim().toUpperCase()).join("|");
}

function displayDateToInput(value?: string) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : raw;
}

function resultMessage(result?: VerificationResult) {
  if (!result) return "";
  const parts: string[] = [];
  if (result.kind === "pan" && result.name) parts.push(`PAN name: ${result.name}`);
  if (result.kind === "dl" && result.name) parts.push(`DL name: ${result.name}`);
  if (result.kind === "vehicle" && result.ownerName) parts.push(`RC owner: ${result.ownerName}`);
  if (result.kind === "vehicle" && result.fuelType) parts.push(`Fuel type: ${result.fuelType}`);
  if (result.kind === "bank" && result.accountName) parts.push(`Bank name: ${result.accountName}`);
  if (result.kind === "pf_uan" && result.name) parts.push(`PF UAN name: ${result.name}`);
  const message = result.warning || result.message || "";
  if (message) parts.push(message);
  return parts.join(" | ");
}

export function ProfileVerificationPanel({ accountId, kind, profileType }: {
  accountId: string;
  kind: VerificationKind;
  profileType: WorkforceProfileType;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [results, setResults] = useState<Partial<Record<VerificationKind, VerificationResult>>>({});
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const form = useCallback(() => {
    return hostRef.current?.closest("form") ?? null;
  }, []);

  const currentFields = useCallback(() => {
    const data = new FormData(form() ?? undefined);
    return {
      fullName: text(data.get("full_name")),
      panNumber: text(data.get("pan_number")).toUpperCase(),
      aadhaarNumber: text(data.get("aadhaar_number")).replace(/\D/g, ""),
      dateOfBirth: text(data.get("date_of_birth")),
      drivingLicenseNo: text(data.get("driving_license_no")).toUpperCase(),
      vehicleRegNo: text(data.get("vehicle_reg_no")).toUpperCase(),
      bankAccountNo: text(data.get("bank_account_no")).replace(/[^A-Za-z0-9]/g, "").toUpperCase(),
      ifsc: text(data.get("ifsc") ?? data.get("ifsc_code")).toUpperCase(),
      pfUan: text(data.get("pf_uan")).replace(/\D/g, "")
    };
  }, [form]);

  const keyFor = useCallback((target: VerificationKind, fields = currentFields()) => {
    if (target === "pan") return inputKey([fields.panNumber]);
    if (target === "pan_aadhaar") return inputKey([fields.panNumber, fields.aadhaarNumber]);
    if (target === "dl") return inputKey([fields.drivingLicenseNo, fields.dateOfBirth.replace(/\//g, "-")]);
    if (target === "vehicle") return inputKey([fields.vehicleRegNo]);
    if (target === "pf_uan") return inputKey([fields.pfUan]);
    return inputKey([fields.bankAccountNo, fields.ifsc]);
  }, [currentFields]);

  function missingMessage(target = kind, fields = currentFields()) {
    if ((target === "pan" || target === "pan_aadhaar") && (!fields.panNumber || !fields.aadhaarNumber)) return "PAN and Aadhaar are required.";
    if (target === "pan_aadhaar" && (!results.pan || results.pan.blockSubmit)) return "Verify PAN first.";
    if (target === "dl" && (!fields.drivingLicenseNo || !fields.dateOfBirth)) return "DL and DOB are required.";
    if (target === "vehicle" && !fields.vehicleRegNo) return "Vehicle number is required.";
    if (target === "bank" && (!fields.bankAccountNo || !fields.ifsc)) return "Bank account and IFSC are required.";
    if (target === "pf_uan" && !fields.pfUan) return "PF UAN is required.";
    return "";
  }

  async function runVerification(target: VerificationKind, fields = currentFields()) {
    const response = await fetch("/api/profile-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, profileType, kind: target, ...fields })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Unable to verify.");
    return { ...body, kind: target } as VerificationResult;
  }

  function setFieldValue(name: string, value?: string) {
    const input = form()?.elements.namedItem(name) as HTMLInputElement | null;
    const next = displayDateToInput(value);
    if (!input || !next) return;
    input.value = next;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function verify() {
    const fields = currentFields();
    const missing = missingMessage(kind, fields);
    if (missing) return setError(missing);
    setError("");
    setRunning(true);
    try {
      const result = await runVerification(kind, fields);
      if (kind === "dl") setFieldValue("driving_license_exp_date", result.expiryDate);
      if (kind === "vehicle") {
        setFieldValue("vehicle_reg_exp_date", result.registrationExpiryDate);
        setFieldValue("vehicle_insurance_exp_date", result.insuranceExpiryDate);
        setFieldValue("vehicle_pollution_exp_date", result.pollutionExpiryDate);
      }
      const next = { ...results, [kind]: result };
      if (kind === "pan") {
        delete next.pan_aadhaar;
        if (!result.blockSubmit) next.pan_aadhaar = await runVerification("pan_aadhaar", fields);
      }
      setResults(next);
      window.dispatchEvent(new CustomEvent("dropx-profile-verification", { detail: next }));
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : "Unable to verify.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    let alive = true;
    fetch(`/api/profile-verification?accountId=${encodeURIComponent(accountId)}&profileType=${encodeURIComponent(profileType)}`)
      .then((response) => response.ok ? response.json() : { verifications: [] })
      .then((body) => {
        if (!alive) return;
        const next: Partial<Record<VerificationKind, VerificationResult>> = {};
        for (const row of body.verifications ?? []) {
          next[row.kind as VerificationKind] = {
            ...(row.details ?? {}),
            kind: row.kind,
            inputKey: row.inputKey,
            verified: row.verified,
            manualReview: row.manualReview,
            blockSubmit: row.blockSubmit,
            message: row.message ?? ""
          };
        }
        setResults(next);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [accountId, profileType]);

  useEffect(() => {
    const currentForm = form();
    if (!currentForm) return;
    const reconcile = () => {
      setResults((current) => {
        const fields = currentFields();
        const next = { ...current };
        if (next[kind]?.inputKey && next[kind]?.inputKey !== keyFor(kind, fields)) delete next[kind];
        if (kind === "pan" && next.pan_aadhaar?.inputKey && next.pan_aadhaar.inputKey !== keyFor("pan_aadhaar", fields)) delete next.pan_aadhaar;
        return next;
      });
    };
    currentForm.addEventListener("input", reconcile);
    currentForm.addEventListener("change", reconcile);
    return () => {
      currentForm.removeEventListener("input", reconcile);
      currentForm.removeEventListener("change", reconcile);
    };
  }, [currentFields, form, keyFor, kind]);

  const fields = currentFields();
  const result = results[kind]?.inputKey === keyFor(kind, fields) ? results[kind] : undefined;
  const panAadhaar = results.pan_aadhaar?.inputKey === keyFor("pan_aadhaar", fields) ? results.pan_aadhaar : undefined;
  const verified = kind === "pan" ? Boolean(result?.verified && panAadhaar?.verified) : Boolean(result?.verified);
  const missing = missingMessage(kind, fields);
  const message = kind === "pan"
    ? [resultMessage(result), panAadhaar?.message].filter(Boolean).join(" | ")
    : resultMessage(result);
  const hidden = kind === "pan" ? [result, panAadhaar].filter(Boolean) : [result].filter(Boolean);

  return <div className={`profile-verification-inline ${verified ? "ok" : result?.manualReview ? "warn" : result ? "error" : ""}`} ref={hostRef}>
    {hidden.length ? <input name="profile_verification_results" type="hidden" value={JSON.stringify(hidden)} /> : null}
    {!verified ? <button className="button secondary small" disabled={running || Boolean(missing)} onClick={verify} type="button">{running ? "Verifying…" : "Verify"}</button> : null}
    <span>{running ? `Verifying ${labels[kind]}…` : result ? message || "Checked." : missing || "Not verified"}</span>
    {error ? <span className="profile-verification-error">{error}</span> : null}
  </div>;
}
