"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHrmsAuth } from "@/lib/auth";
import { isPackageType, PACKAGE_TYPES, type PackageType } from "@/lib/package-types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  addManualAdjustment,
  addPayeeToRun,
  calculatePayrollRun,
  cancelPayrollRun,
  createPayPackage,
  createPayrollRun,
  deletePayPackage,
  lockPayrollRun,
  markPayrollRunPaid,
  savePackageRateOverrides,
  setLineLopOverride,
  unlockPayrollRun,
  upsertPackageEntries,
  type ComponentType,
  type PayeeType
} from "@/lib/payroll-run";

function db() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}
function text(value: FormDataEntryValue | null) { return String(value ?? "").trim(); }
function rethrowRedirect(error: unknown) {
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  if (digest.startsWith("NEXT_REDIRECT")) throw error;
}
function runTarget(runId: string, kind: "error" | "notice", message: string) {
  return `/payroll/${runId}?${kind}=${encodeURIComponent(message)}`;
}
function withFeedback(path: string, kind: "error" | "notice", message: string) {
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}${kind}=${encodeURIComponent(message)}`;
}

async function auditRun(companyId: string, userId: string, runId: string, action: string, afterData?: unknown) {
  const result = await db().from("hr_audit_log").insert({ company_id: companyId, actor_user_id: userId, entity_type: "payroll_run", entity_id: runId, action, after_data: afterData ?? null });
  if (result.error) console.error("Payroll run audit log failed:", result.error.message);
}

export async function createRunAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  try {
    const periodMonth = text(formData.get("period_month"));
    if (!/^\d{4}-\d{2}/.test(periodMonth)) throw new Error("Choose a valid pay period.");
    const runId = await createPayrollRun(auth, periodMonth);
    await auditRun(auth.companyId, auth.userId, runId, "create", { period_month: periodMonth });
    revalidatePath("/payroll");
    redirect(`/payroll/${runId}?notice=${encodeURIComponent("Payroll run created. Open a station to review members and package pay.")}`);
  } catch (error) {
    rethrowRedirect(error);
    redirect(`/payroll?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to create payroll run.")}`);
  }
}

export async function calculateRunAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  const redirectTo = text(formData.get("redirect_to")) || `/payroll/${runId}`;
  try {
    await calculatePayrollRun(auth, runId);
    await auditRun(auth.companyId, auth.userId, runId, "calculate");
    revalidatePath(`/payroll/${runId}`);
    revalidatePath("/payroll");
    redirect(withFeedback(redirectTo, "notice", "Payroll run calculated."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to calculate payroll run."));
  }
}

export async function lockRunAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  try {
    await lockPayrollRun(auth, runId);
    await auditRun(auth.companyId, auth.userId, runId, "lock");
    revalidatePath(`/payroll/${runId}`);
    revalidatePath("/payroll");
    redirect(runTarget(runId, "notice", "Payroll run locked. Amounts can no longer be edited."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(runTarget(runId, "error", error instanceof Error ? error.message : "Unable to lock payroll run."));
  }
}

export async function unlockRunAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  try {
    await unlockPayrollRun(auth, runId);
    await auditRun(auth.companyId, auth.userId, runId, "unlock");
    revalidatePath(`/payroll/${runId}`);
    revalidatePath("/payroll");
    redirect(runTarget(runId, "notice", "Payroll run reopened for edits."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(runTarget(runId, "error", error instanceof Error ? error.message : "Unable to reopen payroll run."));
  }
}

export async function markRunPaidAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  try {
    await markPayrollRunPaid(auth, runId);
    await auditRun(auth.companyId, auth.userId, runId, "mark_paid");
    revalidatePath(`/payroll/${runId}`);
    revalidatePath("/payroll");
    redirect(runTarget(runId, "notice", "Payroll run marked as paid."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(runTarget(runId, "error", error instanceof Error ? error.message : "Unable to mark payroll run as paid."));
  }
}

export async function cancelRunAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  try {
    await cancelPayrollRun(auth, runId);
    await auditRun(auth.companyId, auth.userId, runId, "cancel");
    revalidatePath("/payroll");
    redirect(`/payroll?notice=${encodeURIComponent("Payroll run cancelled.")}`);
  } catch (error) {
    rethrowRedirect(error);
    redirect(runTarget(runId, "error", error instanceof Error ? error.message : "Unable to cancel payroll run."));
  }
}

export async function setLopOverrideAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  const runLineId = text(formData.get("run_line_id"));
  const redirectTo = text(formData.get("redirect_to")) || `/payroll/${runId}/lines/${runLineId}`;
  try {
    const lopDays = Number(formData.get("lop_days"));
    await setLineLopOverride(auth, runLineId, lopDays);
    await auditRun(auth.companyId, auth.userId, runId, "override_lop", { run_line_id: runLineId, lop_days: lopDays });
    revalidatePath(`/payroll/${runId}`);
    revalidatePath(redirectTo);
    redirect(withFeedback(redirectTo, "notice", "Loss of pay updated and the run was recalculated."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to update loss of pay."));
  }
}

export async function addAdjustmentAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  const runLineId = text(formData.get("run_line_id"));
  const redirectTo = text(formData.get("redirect_to")) || `/payroll/${runId}/lines/${runLineId}`;
  try {
    const name = text(formData.get("name"));
    const amount = Number(formData.get("amount"));
    const type = text(formData.get("type")) as ComponentType;
    if (!["earning", "deduction", "employer_contribution"].includes(type)) throw new Error("Choose a valid adjustment type.");
    await addManualAdjustment(auth, runLineId, { name, amount, type });
    await auditRun(auth.companyId, auth.userId, runId, "add_adjustment", { run_line_id: runLineId, name, amount, type });
    revalidatePath(`/payroll/${runId}`);
    revalidatePath(redirectTo);
    redirect(withFeedback(redirectTo, "notice", "Adjustment added."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to add adjustment."));
  }
}

export async function addPayPackageAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const redirectTo = text(formData.get("redirect_to")) || "/payroll";
  try {
    const [payeeType, payeeId] = text(formData.get("payee")).split(":");
    if (!payeeType || !payeeId || !["employee", "contractor"].includes(payeeType)) throw new Error("Select who this job or package is for.");
    await createPayPackage(auth, {
      payeeType: payeeType as PayeeType,
      payeeId,
      title: text(formData.get("title")),
      description: text(formData.get("description")),
      amount: Number(formData.get("amount")),
      jobDate: text(formData.get("job_date"))
    });
    revalidatePath(redirectTo);
    revalidatePath("/payroll");
    redirect(withFeedback(redirectTo, "notice", "Job/package pay entry added."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to add job/package entry."));
  }
}

export async function deletePayPackageAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const redirectTo = text(formData.get("redirect_to")) || "/payroll";
  try {
    await deletePayPackage(auth, text(formData.get("package_id")));
    revalidatePath(redirectTo);
    redirect(withFeedback(redirectTo, "notice", "Job/package pay entry removed."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to remove job/package entry."));
  }
}

export async function addPayeeToRunAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  const stationId = text(formData.get("station_id"));
  const redirectTo = text(formData.get("redirect_to")) || `/payroll/${runId}/stations/${stationId}`;
  try {
    const [payeeType, payeeId] = text(formData.get("payee")).split(":");
    if (!payeeType || !payeeId || !["employee", "contractor"].includes(payeeType)) throw new Error("Select a member to add.");
    await addPayeeToRun(auth, runId, payeeType as PayeeType, payeeId);
    await auditRun(auth.companyId, auth.userId, runId, "add_payee", { payee_type: payeeType, payee_id: payeeId, station_id: stationId });
    revalidatePath(`/payroll/${runId}`);
    revalidatePath(redirectTo);
    redirect(withFeedback(redirectTo, "notice", "Member added to this payroll run."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to add member."));
  }
}

export async function saveStationPackageEntriesAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  const stationId = text(formData.get("station_id"));
  const redirectTo = text(formData.get("redirect_to")) || `/payroll/${runId}/stations/${stationId}`;
  try {
    const lineIds = formData.getAll("line_id").map((value) => String(value));
    for (const lineId of lineIds) {
      const entries = PACKAGE_TYPES.map((packageType) => ({
        packageType,
        quantity: Number(formData.get(`qty_${lineId}_${packageType}`) ?? 0)
      }));
      await upsertPackageEntries(auth, lineId, entries);
    }
    await auditRun(auth.companyId, auth.userId, runId, "save_package_entries", { station_id: stationId, line_ids: lineIds });
    revalidatePath(`/payroll/${runId}`);
    revalidatePath(redirectTo);
    redirect(withFeedback(redirectTo, "notice", "Package counts saved. Recalculate the run to refresh deductions."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to save package counts."));
  }
}

export async function saveMemberPackageEntriesAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  const runLineId = text(formData.get("run_line_id"));
  const redirectTo = text(formData.get("redirect_to")) || `/payroll/${runId}/lines/${runLineId}`;
  try {
    const entries = PACKAGE_TYPES.map((packageType) => {
      const rateRaw = text(formData.get(`rate_${packageType}`));
      return {
        packageType,
        quantity: Number(formData.get(`qty_${packageType}`) ?? 0),
        ...(rateRaw ? { rate: Number(rateRaw) } : {})
      };
    });
    await upsertPackageEntries(auth, runLineId, entries);
    await auditRun(auth.companyId, auth.userId, runId, "save_member_package_entries", { run_line_id: runLineId });
    revalidatePath(`/payroll/${runId}`);
    revalidatePath(redirectTo);
    redirect(withFeedback(redirectTo, "notice", "Package counts saved. Recalculate the run to refresh deductions."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to save package counts."));
  }
}

export async function saveMemberPackageRatesAction(formData: FormData) {
  const auth = await requireHrmsAuth("payroll.process");
  const runId = text(formData.get("run_id"));
  const runLineId = text(formData.get("run_line_id"));
  const payeeType = text(formData.get("payee_type")) as PayeeType;
  const payeeId = text(formData.get("payee_id"));
  const redirectTo = text(formData.get("redirect_to")) || `/payroll/${runId}/lines/${runLineId}`;
  try {
    if (!["employee", "contractor"].includes(payeeType) || !payeeId) throw new Error("Invalid payee.");
    const rates = PACKAGE_TYPES.map((packageType) => {
      const raw = text(formData.get(`override_${packageType}`));
      if (!raw) return { packageType, rate: null as number | null };
      const rate = Number(raw);
      if (!Number.isFinite(rate) || rate < 0) throw new Error(`Enter a valid override for ${packageType}.`);
      return { packageType, rate };
    });
    await savePackageRateOverrides(auth, payeeType, payeeId, rates);

    // Re-apply current quantities with new effective rates.
    const entries = PACKAGE_TYPES.map((packageType) => ({
      packageType: packageType as PackageType,
      quantity: Number(formData.get(`qty_${packageType}`) ?? 0)
    })).filter((entry) => isPackageType(entry.packageType));
    if (entries.some((entry) => entry.quantity > 0) || formData.has("qty_delivery_package")) {
      await upsertPackageEntries(auth, runLineId, entries);
    }

    await auditRun(auth.companyId, auth.userId, runId, "save_member_package_rates", { run_line_id: runLineId, payee_id: payeeId });
    revalidatePath(`/payroll/${runId}`);
    revalidatePath(redirectTo);
    redirect(withFeedback(redirectTo, "notice", "Member package rates updated."));
  } catch (error) {
    rethrowRedirect(error);
    redirect(withFeedback(redirectTo, "error", error instanceof Error ? error.message : "Unable to save package rates."));
  }
}
