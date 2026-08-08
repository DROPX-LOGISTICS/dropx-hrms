import "server-only";
import { unstable_cache } from "next/cache";
import { HrmsAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PtSlab = { id: string; minIncome: number; maxIncome: number | null; monthlyTax: number };

export type StatutorySettings = {
  pfEnabled: boolean;
  pfEmployeeRate: number;
  pfEmployerRate: number;
  pfWageCeiling: number;
  esiEnabled: boolean;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  esiWageCeiling: number;
  ptEnabled: boolean;
  ptSlabs: PtSlab[];
  tdsEnabled: boolean;
};

const DEFAULT_STATUTORY_SETTINGS: StatutorySettings = {
  pfEnabled: true,
  pfEmployeeRate: 12,
  pfEmployerRate: 12,
  pfWageCeiling: 15000,
  esiEnabled: true,
  esiEmployeeRate: 0.75,
  esiEmployerRate: 3.25,
  esiWageCeiling: 21000,
  ptEnabled: true,
  ptSlabs: [],
  tdsEnabled: false
};

function db() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const getCachedStatutorySettings = unstable_cache(async (companyId: string): Promise<StatutorySettings> => {
  const { data, error } = await db().from("hr_statutory_settings").select("*").eq("company_id", companyId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_STATUTORY_SETTINGS;
  const slabs = Array.isArray(data.pt_slabs) ? data.pt_slabs : [];
  return {
    pfEnabled: Boolean(data.pf_enabled),
    pfEmployeeRate: Number(data.pf_employee_rate),
    pfEmployerRate: Number(data.pf_employer_rate),
    pfWageCeiling: Number(data.pf_wage_ceiling),
    esiEnabled: Boolean(data.esi_enabled),
    esiEmployeeRate: Number(data.esi_employee_rate),
    esiEmployerRate: Number(data.esi_employer_rate),
    esiWageCeiling: Number(data.esi_wage_ceiling),
    ptEnabled: Boolean(data.pt_enabled),
    ptSlabs: slabs.map((slab: Record<string, unknown>, index: number) => ({
      id: String(slab.id ?? index),
      minIncome: Number(slab.min_income ?? 0),
      maxIncome: slab.max_income === null || slab.max_income === undefined ? null : Number(slab.max_income),
      monthlyTax: Number(slab.monthly_tax ?? 0)
    })),
    tdsEnabled: Boolean(data.tds_enabled)
  };
}, ["hrms-statutory-settings-v1"], { revalidate: 30 });

export async function loadStatutorySettings(auth: HrmsAuthContext) {
  return getCachedStatutorySettings(auth.companyId);
}

export function computeProfessionalTax(monthlyGross: number, settings: StatutorySettings) {
  if (!settings.ptEnabled || monthlyGross <= 0) return 0;
  const slab = settings.ptSlabs.find((item) => monthlyGross >= item.minIncome && (item.maxIncome === null || monthlyGross <= item.maxIncome));
  return slab ? roundMoney(slab.monthlyTax) : 0;
}

export function computePf(basicWage: number, settings: StatutorySettings) {
  if (!settings.pfEnabled || basicWage <= 0) return { employee: 0, employer: 0, base: 0 };
  const base = settings.pfWageCeiling > 0 ? Math.min(basicWage, settings.pfWageCeiling) : basicWage;
  return {
    base: roundMoney(base),
    employee: roundMoney((base * settings.pfEmployeeRate) / 100),
    employer: roundMoney((base * settings.pfEmployerRate) / 100)
  };
}

export function computeEsi(grossWage: number, settings: StatutorySettings) {
  if (!settings.esiEnabled || grossWage <= 0 || grossWage > settings.esiWageCeiling) return { employee: 0, employer: 0, base: 0 };
  return {
    base: roundMoney(grossWage),
    employee: roundMoney((grossWage * settings.esiEmployeeRate) / 100),
    employer: roundMoney((grossWage * settings.esiEmployerRate) / 100)
  };
}
