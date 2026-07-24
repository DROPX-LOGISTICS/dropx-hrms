import "server-only";
import { HrmsAuthContext } from "@/lib/auth";
import { loadPayrollSettings, SalaryConfigurationRow } from "@/lib/payroll";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type EmployeeSalaryAssignment = {
  id: string;
  configuration_id: string;
  effective_from: string;
  effective_to: string | null;
  hr_employee_salary_values: Array<{
    payroll_head_id: string;
    amount: number;
  }>;
};

export type EmployeeSalarySettings = {
  configurations: SalaryConfigurationRow[];
  assignment: EmployeeSalaryAssignment | null;
};

function database() {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  return supabaseAdmin;
}

export async function loadEmployeeSalarySettings(
  auth: HrmsAuthContext,
  employeeId: string
): Promise<EmployeeSalarySettings> {
  const [{ configurations }, assignmentResult] = await Promise.all([
    loadPayrollSettings(auth),
    database()
      .from("hr_employee_salary_assignments")
      .select("id, configuration_id, effective_from, effective_to, hr_employee_salary_values(payroll_head_id, amount)")
      .eq("company_id", auth.companyId)
      .eq("employee_id", employeeId)
      .is("effective_to", null)
      .maybeSingle()
  ]);
  if (assignmentResult.error) throw new Error(assignmentResult.error.message);
  const assignment = assignmentResult.data
    ? {
        ...assignmentResult.data,
        hr_employee_salary_values: (assignmentResult.data.hr_employee_salary_values ?? []).map((value) => ({
          ...value,
          amount: Number(value.amount)
        }))
      }
    : null;
  return { configurations, assignment };
}
