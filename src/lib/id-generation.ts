import { supabaseAdmin } from "./supabase/admin";

type EmployeeIdType = "dropx_id" | "biometric_id";

type GenerateEmployeeIdInput = {
  companyId: string;
  designationId: string;
  locationId: string;
  modelId?: string | null;
};

const generators: Record<EmployeeIdType, { functionName: string; label: string }> = {
  dropx_id: { functionName: "generate_dropx_worker_id", label: "Employee ID" },
  biometric_id: { functionName: "generate_biometric_worker_id", label: "Biometric ID" }
};

async function generateEmployeeId(type: EmployeeIdType, input: GenerateEmployeeIdInput) {
  if (!supabaseAdmin) throw new Error("Database configuration is missing.");
  const generator = generators[type];
  const { data, error } = await supabaseAdmin.rpc(generator.functionName, {
    p_category: "employee",
    p_company_id: input.companyId,
    p_designation_id: input.designationId,
    p_location_id: input.locationId,
    p_model_id: input.modelId ?? null
  });
  if (error) throw new Error(`${generator.label} could not be generated: ${error.message}`);
  const generatedId = String(data ?? "").trim();
  if (!generatedId) {
    throw new Error(`${generator.label} generation is not configured or active. Configure it in Dashboard > Settings > ID Generation.`);
  }
  return generatedId;
}

export function generateEmployeeCode(input: GenerateEmployeeIdInput) {
  return generateEmployeeId("dropx_id", input);
}

export function generateEmployeeBiometricId(input: GenerateEmployeeIdInput) {
  return generateEmployeeId("biometric_id", input);
}
