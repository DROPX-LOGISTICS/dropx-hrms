import "server-only";
import { HrmsAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type PayrollHeadType =
  | "ctc"
  | "employee_earning"
  | "employee_deduction"
  | "statutory_deduction"
  | "statutory_contribution";
export type PayrollHeadRow = {
  id: string;
  code: string;
  name: string;
  head_type: PayrollHeadType;
  is_system: boolean;
  display_order: number;
  is_active: boolean;
};
export type SalaryConfigurationItemRow = {
  id: string;
  payroll_head_id: string;
  calculation_type: "input" | "fixed" | "formula";
  formula: string | null;
  fixed_amount: number | null;
  value_expression: string | null;
  minimum_value: number | null;
  maximum_value: number | null;
  is_enabled: boolean;
  display_order: number;
  hr_payroll_heads: PayrollHeadRow | null;
};
export type SalaryConfigurationRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  effective_from: string;
  effective_to: string | null;
  annualisation_factor: number;
  is_default: boolean;
  is_active: boolean;
  hr_salary_configuration_items: SalaryConfigurationItemRow[];
};

function db() {
  if (!supabaseAdmin) throw new Error("Supabase service-role configuration is missing.");
  return supabaseAdmin;
}

export async function loadPayrollSettings(auth: HrmsAuthContext) {
  const [headsResult, configurationsResult] = await Promise.all([
    db().from("hr_payroll_heads").select("id, code, name, head_type, is_system, display_order, is_active").eq("company_id", auth.companyId).order("display_order").order("name"),
    db().from("hr_salary_configurations").select("id, code, name, description, effective_from, effective_to, annualisation_factor, is_default, is_active, hr_salary_configuration_items(id, payroll_head_id, calculation_type, formula, fixed_amount, value_expression, minimum_value, maximum_value, is_enabled, display_order, hr_payroll_heads(id, code, name, head_type, is_system, display_order, is_active))").eq("company_id", auth.companyId).order("created_at", { ascending: false })
  ]);
  const error = headsResult.error ?? configurationsResult.error;
  if (error) throw new Error(error.message);
  const heads = (headsResult.data ?? []) as PayrollHeadRow[];
  const configurations = (configurationsResult.data ?? []) as unknown as SalaryConfigurationRow[];
  for (const configuration of configurations) {
    configuration.hr_salary_configuration_items = (configuration.hr_salary_configuration_items ?? [])
      .map((item) => ({
        ...item,
        fixed_amount: item.fixed_amount === null ? null : Number(item.fixed_amount),
        minimum_value: item.minimum_value === null ? null : Number(item.minimum_value),
        maximum_value: item.maximum_value === null ? null : Number(item.maximum_value)
      }))
      .sort((a, b) => a.display_order - b.display_order);
  }
  return { heads, configurations };
}
