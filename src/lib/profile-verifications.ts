import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { WorkforceProfileType } from "@/lib/workforce-profile";

export type VerificationKind = "pan" | "pan_aadhaar" | "dl" | "vehicle" | "bank" | "pf_uan";

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function isMissingVerificationTable(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  return message.includes("connect_profile_verifications") || message.includes("schema cache") || message.includes("does not exist");
}

export async function saveProfileVerification(input: {
  accountId: string;
  companyId: string;
  kind: VerificationKind;
  profileType: WorkforceProfileType;
  result: Record<string, unknown>;
}) {
  if (!supabaseAdmin || !text(input.result.inputKey)) return;
  const { error } = await supabaseAdmin.from("connect_profile_verifications").upsert({
    company_id: input.companyId,
    profile_type: input.profileType,
    account_id: input.accountId,
    kind: input.kind,
    input_key: text(input.result.inputKey),
    verified: input.result.verified === true,
    manual_review: input.result.manualReview === true,
    block_submit: input.result.blockSubmit === true,
    display_name: text(input.result.name || input.result.accountName || input.result.ownerName),
    message: text(input.result.message || input.result.warning),
    details: { ...input.result, kind: input.kind },
    verified_at: input.result.verified === true ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id,profile_type,account_id,kind" });
  if (error && !isMissingVerificationTable(error)) throw new Error(error.message);
}

export async function saveProfileVerifications(input: {
  accountId: string;
  companyId: string;
  profileType: WorkforceProfileType;
  values: FormDataEntryValue[] | string[];
}) {
  const seen = new Set<string>();
  for (const value of input.values) {
    const raw = text(value);
    if (!raw) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const result = row as Record<string, unknown>;
      const kind = text(result.kind) as VerificationKind;
      if (!["pan", "pan_aadhaar", "dl", "vehicle", "bank", "pf_uan"].includes(kind)) continue;
      const key = `${kind}:${text(result.inputKey)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await saveProfileVerification({ ...input, kind, result });
    }
  }
}
