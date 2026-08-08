import { NextRequest, NextResponse } from "next/server";
import { getHrmsAuth } from "@/lib/auth";
import { matchNames } from "@/lib/name-match";
import { isMissingVerificationTable, type VerificationKind } from "@/lib/profile-verifications";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { WorkforceProfileType } from "@/lib/workforce-profile";

const IDSPAY_BASE_URL = "https://javabackend.idspay.in/api/v1/prod";

function text(value: unknown) {
  return String(value ?? "").trim();
}

function compact(value: unknown) {
  return text(value).replace(/\s+/g, " ");
}

function onlyDigits(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function inputKey(parts: unknown[]) {
  return parts.map((part) => text(part).toUpperCase()).join("|");
}

function deepText(value: unknown): string {
  if (value == null) return "";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map(deepText).join(" ");
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).map(deepText).join(" ");
  return "";
}

function findFirstString(value: unknown, keys: string[]): string {
  if (value == null) return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstString(item, keys);
      if (found) return found;
    }
    return "";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      const direct = record[key];
      if (typeof direct === "string" || typeof direct === "number") {
        const found = text(direct);
        if (found) return found;
      }
    }
    for (const item of Object.values(record)) {
      const found = findFirstString(item, keys);
      if (found) return found;
    }
  }
  return "";
}

function uanName(body: unknown) {
  const data = (body as { data?: unknown })?.data as Record<string, unknown> | undefined;
  const details = data?.uan_details;
  if (details && typeof details === "object") {
    for (const row of Object.values(details as Record<string, unknown>)) {
      const basic = (row as { basic_details?: unknown })?.basic_details as Record<string, unknown> | undefined;
      const found = compact(basic?.name);
      if (found) return found;
    }
  }
  return compact(findFirstString(body, ["employee_name", "employeeName", "name", "full_name", "fullName"]));
}

function normalizeDate(value: unknown) {
  const raw = text(value);
  const match = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match ? `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}` : raw;
}

function parseDate(value: string) {
  const match = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))) : null;
}

function idspayDob(value: unknown) {
  const raw = text(value);
  const local = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  if (local) return `${local[1]}-${local[2]}-${local[3]}`;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}-${iso[2]}-${iso[1]}` : raw.replace(/\//g, "-");
}

function isElectricFuel(value: unknown) {
  const fuel = text(value).toLowerCase();
  return fuel.includes("electric") || fuel === "ev";
}

function validProfileType(value: unknown): value is WorkforceProfileType {
  return value === "employee" || value === "contractor";
}

async function workforceAccount(accountId: string, profileType: WorkforceProfileType) {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  const auth = await getHrmsAuth();
  if (!auth || !auth.permissions.has("people.manage")) throw new Error("Login required.");
  const table = profileType === "employee" ? "employees" : "contractors";
  const select = profileType === "employee"
    ? "id, company_id, employee_code, full_name, location_id"
    : "id, company_id, dropx_id, full_name, location_id";
  let query = supabaseAdmin.from(table).select(select).eq("id", accountId).eq("company_id", auth.companyId);
  if (!auth.allLocations) query = query.in("location_id", auth.locationIds);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Account not found.");
  const code = profileType === "employee"
    ? compact((data as { employee_code?: unknown }).employee_code)
    : compact((data as { dropx_id?: unknown }).dropx_id);
  return { companyId: data.company_id as string, fullName: compact(data.full_name), accountCode: code };
}

async function idspayCredentials(companyId: string) {
  // console.log("idspayCredentials", companyId);
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  const settings = await supabaseAdmin
    .from("verification_api_settings")
    .select("api_id, is_enabled")
    .eq("company_id", companyId)
    .eq("provider_code", "idspay")
    .maybeSingle();
  console.log("settings", settings);
  if (settings.error) throw new Error(settings.error.message);
  if (!settings.data?.is_enabled) throw new Error("IDSPAY verification API is not enabled in Dashboard settings.");
  const [apiKey, tokenId] = await Promise.all([
    supabaseAdmin.rpc("get_verification_api_secret", { company_uuid: companyId, provider: "idspay", secret_kind: "api_key" }),
    supabaseAdmin.rpc("get_verification_api_secret", { company_uuid: companyId, provider: "idspay", secret_kind: "token_id" })
  ]);
  if (apiKey.error) throw new Error(apiKey.error.message),console.log(apiKey.error);
  if (tokenId.error) throw new Error(tokenId.error.message),console.log(tokenId.error);
  return { api_id: text(settings.data.api_id), api_key: text(apiKey.data), token_id: text(tokenId.data) };
}

async function callIdspay(path: string, payload: Record<string, unknown>) {
  const response = await fetch(`${IDSPAY_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store"
  });
  return response.json().catch(() => ({}));
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseAdmin) throw new Error("Database configuration is missing.");
    const accountId = text(request.nextUrl.searchParams.get("accountId"));
    const profileType = text(request.nextUrl.searchParams.get("profileType"));
    if (!accountId || !validProfileType(profileType)) throw new Error("A valid account is required.");
    const account = await workforceAccount(accountId, profileType);
    const result = await supabaseAdmin
      .from("connect_profile_verifications")
      .select("kind, input_key, verified, manual_review, block_submit, display_name, message, details, verified_at")
      .eq("company_id", account.companyId)
      .eq("profile_type", profileType)
      .eq("account_id", accountId);
    if (result.error) {
      if (isMissingVerificationTable(result.error)) return NextResponse.json({ verifications: [] });
      throw new Error(result.error.message);
    }
    return NextResponse.json({
      verifications: (result.data ?? []).map((row) => ({
        kind: row.kind,
        inputKey: row.input_key,
        verified: row.verified,
        manualReview: row.manual_review,
        blockSubmit: row.block_submit,
        name: row.display_name,
        message: row.message,
        details: row.details,
        verifiedAt: row.verified_at
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load verification status.";
    return NextResponse.json({ error: message }, { status: message.includes("Login") ? 401 : 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const kind = text(payload.kind) as VerificationKind;
    const accountId = text(payload.accountId);
    const profileType = text(payload.profileType);
    if (!accountId || !validProfileType(profileType)) throw new Error("A valid account is required.");
    const account = await workforceAccount(accountId, profileType);
    const credentials = await idspayCredentials(account.companyId);
    const registeredName = compact(payload.fullName) || account.fullName;

    if (kind === "pan") {
      const panNumber = text(payload.panNumber).toUpperCase();
      if (!panNumber) throw new Error("PAN number is required.");
      const body = await callIdspay("/pan/verification", { ...credentials, pan_number: panNumber });
      const apiName = compact(findFirstString(body, ["full_name", "fullName", "name", "pan_name", "panName"]));
      const apiSuccess = body?.data?.success === true || body?.status?.type === "success";
      const nameMatch = apiSuccess ? matchNames(registeredName, apiName) : { status: "none" as const, percent: 0 };
      const verified = apiSuccess && nameMatch.status === "exact";
      const partial = apiSuccess && nameMatch.status === "partial";
      return NextResponse.json({
        verified,
        manualReview: partial,
        blockSubmit: !apiSuccess || nameMatch.status === "none",
        inputKey: inputKey([panNumber]),
        name: apiName,
        nameMatchStatus: nameMatch.status,
        nameMatchPercent: nameMatch.percent,
        message: verified ? "PAN verified." : partial ? "PAN name partially matched. Profile requires review." : apiSuccess ? "PAN name mismatch." : "PAN verification failed."
      });
    }

    if (kind === "pan_aadhaar") {
      const pan = text(payload.panNumber).toUpperCase();
      const aadhar = onlyDigits(payload.aadhaarNumber);
      if (!pan || !aadhar) throw new Error("PAN and Aadhaar number are required.");
      const body = await callIdspay("/srv2/validation/pan-aadhaar-link", { ...credentials, pan, aadhar, aadhaar: aadhar });
      const code = Number(body?.result_code);
      const resultCode = text(body?.result?.code).toUpperCase();
      const resultMessage = text(body?.result?.message).toLowerCase();
      const responseText = deepText(body).toLowerCase();
      const verified = code === 101 || resultCode === "LINK-001" || resultMessage.includes("already linked") || responseText.includes("is already linked");
      return NextResponse.json({
        verified,
        manualReview: !verified,
        inputKey: inputKey([pan, aadhar]),
        message: text(body?.data?.message) || text(body?.result?.message) || (verified ? "PAN Aadhaar link verified." : "PAN Aadhaar link verification failed.")
      });
    }

    if (kind === "dl") {
      const dlNumber = text(payload.drivingLicenseNo).toUpperCase();
      const dob = idspayDob(payload.dateOfBirth);
      if (!dlNumber || !dob) throw new Error("DL number and date of birth are required.");
      const body = await callIdspay("/srv2/validation/dl", { ...credentials, dlNumber, dob });
      const details = body?.data?.details_of_driving_licence ?? {};
      const apiName = compact(details?.name || findFirstString(body, ["name", "full_name", "fullName"]));
      const transportExpiry = normalizeDate(body?.data?.dl_validity?.transport?.to);
      const nonTransportExpiry = normalizeDate(body?.data?.dl_validity?.non_transport?.to);
      const expiryDate = transportExpiry && transportExpiry.toUpperCase() !== "NA" ? transportExpiry : nonTransportExpiry;
      const parsedExpiry = parseDate(expiryDate);
      const expired = parsedExpiry ? parsedExpiry.getTime() < Date.now() : false;
      const apiSuccess = body?.status?.type === "success" || text(body?.message).toLowerCase().includes("validated");
      const nameMatch = apiSuccess ? matchNames(registeredName, apiName) : { status: "none" as const, percent: 0 };
      const verified = apiSuccess && nameMatch.status === "exact" && !expired;
      const partial = apiSuccess && nameMatch.status === "partial" && !expired;
      return NextResponse.json({
        verified,
        manualReview: partial,
        blockSubmit: expired || !apiSuccess || nameMatch.status === "none",
        inputKey: inputKey([dlNumber, dob]),
        name: apiName,
        expiryDate,
        message: expired ? "DL is expired." : verified ? "DL verified." : partial ? "DL name partially matched. Profile requires review." : apiSuccess ? "DL name mismatch." : "DL verification failed."
      });
    }

    if (kind === "vehicle") {
      const regNo = text(payload.vehicleRegNo).toUpperCase();
      if (!regNo) throw new Error("Vehicle registration number is required.");
      const body = await callIdspay("/srv2/validation/rc", { ...credentials, reg_no: regNo });
      const data = body?.data ?? {};
      const verified = body?.status?.type === "success" || body?.success === true;
      const fuelType = compact(data?.type ?? data?.fuel_type ?? data?.fuelType);
      return NextResponse.json({
        verified,
        inputKey: inputKey([regNo]),
        ownerName: compact(data?.owner_name),
        fuelType,
        warning: verified ? "" : text(body?.message) || "Vehicle details could not be verified.",
        registrationExpiryDate: normalizeDate(data?.rc_expiry_date),
        insuranceExpiryDate: normalizeDate(data?.vehicle_insurance_upto ?? data?.insurance_upto),
        pollutionExpiryDate: isElectricFuel(fuelType) ? "" : normalizeDate(data?.pucc_upto)
      });
    }

    if (kind === "bank") {
      const creditorAccountId = text(payload.bankAccountNo);
      const ifscCode = text(payload.ifsc).toUpperCase();
      if (!creditorAccountId || !ifscCode) throw new Error("Bank account number and IFSC are required.");
      const body = await callIdspay("/idfc/beneficiary", { ...credentials, creditorAccountId, ifscCode });
      const resource = body?.data?.beneValidationResp?.resourceData ?? {};
      const verified = text(body?.data?.beneValidationResp?.metaData?.status).toUpperCase() === "SUCCESS";
      return NextResponse.json({
        verified,
        inputKey: inputKey([creditorAccountId, ifscCode]),
        accountName: compact(resource?.creditorName),
        message: verified ? text(body?.message) || "Bank account verified." : "Bank verification failed."
      });
    }

    if (kind === "pf_uan") {
      const uan = onlyDigits(payload.pfUan ?? payload.uan);
      if (!uan) throw new Error("PF UAN is required.");
      const body = await callIdspay("/srv3/uan-direct", { ...credentials, uan });
      const apiName = uanName(body);
      const apiSuccess = body?.status?.type === "success" || text(body?.message).toLowerCase() === "success";
      const nameMatch = apiSuccess ? matchNames(registeredName, apiName) : { status: "none" as const, percent: 0 };
      const verified = apiSuccess && nameMatch.status === "exact";
      const partial = apiSuccess && nameMatch.status === "partial";
      return NextResponse.json({
        verified,
        manualReview: partial,
        blockSubmit: !apiSuccess || nameMatch.status === "none",
        inputKey: inputKey([uan]),
        name: apiName,
        nameMatchStatus: nameMatch.status,
        nameMatchPercent: nameMatch.percent,
        message: verified ? "PF UAN verified." : partial ? "PF UAN name partially matched. Profile requires review." : apiSuccess ? "PF UAN name mismatch." : "PF UAN verification failed."
      });
    }

    throw new Error("Unsupported verification type.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify.";
    return NextResponse.json({ error: message }, { status: message.includes("Login") ? 401 : 400 });
  }
}
