"use server";

import { revalidatePath } from "next/cache";
import { requireHrmsAuth } from "@/lib/auth";
import { actionError, actionSuccess, type ActionFeedbackState } from "@/lib/action-feedback";
import { supabaseAdmin } from "@/lib/supabase/admin";

function db() {
  if (!supabaseAdmin) return null;
  return supabaseAdmin;
}

function values(formData: FormData, name: string) {
  return formData.getAll(name).map((item) => String(item).trim());
}

function checkedRate(formData: FormData, name: string, min: number, max: number) {
  const value = Number(formData.get(name));
  if (!Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

export async function saveStatutorySettings(_prev: ActionFeedbackState, formData: FormData): Promise<ActionFeedbackState> {
  const auth = await requireHrmsAuth("settings.manage");
  const database = db();
  if (!database) return actionError("Database configuration is missing.");

  const pfEnabled = formData.get("pf_enabled") === "on";
  const esiEnabled = formData.get("esi_enabled") === "on";
  const ptEnabled = formData.get("pt_enabled") === "on";
  const tdsEnabled = formData.get("tds_enabled") === "on";

  const pfEmployeeRate = checkedRate(formData, "pf_employee_rate", 0, 100);
  const pfEmployerRate = checkedRate(formData, "pf_employer_rate", 0, 100);
  const pfWageCeiling = checkedRate(formData, "pf_wage_ceiling", 0, 10_000_000);
  const esiEmployeeRate = checkedRate(formData, "esi_employee_rate", 0, 100);
  const esiEmployerRate = checkedRate(formData, "esi_employer_rate", 0, 100);
  const esiWageCeiling = checkedRate(formData, "esi_wage_ceiling", 0, 10_000_000);

  if (pfEmployeeRate === null || pfEmployerRate === null || pfWageCeiling === null || esiEmployeeRate === null || esiEmployerRate === null || esiWageCeiling === null) {
    return actionError("Enter valid PF and ESI rates and wage ceilings.");
  }

  const slabMins = values(formData, "slab_min");
  const slabMaxes = values(formData, "slab_max");
  const slabAmounts = values(formData, "slab_amount");
  if (slabMins.length !== slabMaxes.length || slabMins.length !== slabAmounts.length) {
    return actionError("Professional tax slab rows are incomplete.");
  }

  let ptSlabs: Array<{ min_income: number; max_income: number | null; monthly_tax: number }>;
  try {
    ptSlabs = slabMins.map((min, index) => {
      const minIncome = Number(min);
      const maxRaw = slabMaxes[index];
      const maxIncome = maxRaw === "" ? null : Number(maxRaw);
      const monthlyTax = Number(slabAmounts[index]);
      if (!Number.isFinite(minIncome) || minIncome < 0) throw new Error("Each slab needs a valid starting income.");
      if (maxIncome !== null && (!Number.isFinite(maxIncome) || maxIncome < minIncome)) throw new Error("A slab's upper limit must be greater than its starting income.");
      if (!Number.isFinite(monthlyTax) || monthlyTax < 0) throw new Error("Each slab needs a valid monthly tax amount.");
      return { min_income: minIncome, max_income: maxIncome, monthly_tax: monthlyTax };
    }).sort((a, b) => a.min_income - b.min_income);
  } catch (error) {
    return actionError(error instanceof Error ? error.message : "Invalid professional tax slabs.");
  }

  const { error } = await database.from("hr_statutory_settings").upsert({
    company_id: auth.companyId,
    pf_enabled: pfEnabled,
    pf_employee_rate: pfEmployeeRate,
    pf_employer_rate: pfEmployerRate,
    pf_wage_ceiling: pfWageCeiling,
    esi_enabled: esiEnabled,
    esi_employee_rate: esiEmployeeRate,
    esi_employer_rate: esiEmployerRate,
    esi_wage_ceiling: esiWageCeiling,
    pt_enabled: ptEnabled,
    pt_slabs: ptSlabs,
    tds_enabled: tdsEnabled,
    updated_by: auth.userId,
    updated_at: new Date().toISOString()
  }, { onConflict: "company_id" });
  if (error) return actionError(error.message);

  revalidatePath("/settings/statutory");
  revalidatePath("/payroll");
  return actionSuccess("Statutory settings saved.");
}
