import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("./supabase/admin", () => ({ supabaseAdmin: { rpc } }));

import { generateEmployeeBiometricId, generateEmployeeCode } from "./id-generation";

const input = {
  companyId: "company-1",
  designationId: "designation-1",
  locationId: "location-1",
  modelId: "model-1"
};

describe("shared employee ID generation", () => {
  beforeEach(() => rpc.mockReset());

  it("uses the dashboard DropX ID generator with the employee scope", async () => {
    rpc.mockResolvedValue({ data: "DROPX504", error: null });

    await expect(generateEmployeeCode(input)).resolves.toBe("DROPX504");
    expect(rpc).toHaveBeenCalledWith("generate_dropx_worker_id", {
      p_category: "employee",
      p_company_id: "company-1",
      p_designation_id: "designation-1",
      p_location_id: "location-1",
      p_model_id: "model-1"
    });
  });

  it("uses the dashboard biometric ID generator", async () => {
    rpc.mockResolvedValue({ data: "504", error: null });

    await expect(generateEmployeeBiometricId({ ...input, modelId: null })).resolves.toBe("504");
    expect(rpc).toHaveBeenCalledWith("generate_biometric_worker_id", expect.objectContaining({
      p_category: "employee",
      p_model_id: null
    }));
  });

  it("requires an active matching master instead of silently using another counter", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(generateEmployeeCode(input)).rejects.toThrow("Dashboard > Settings > ID Generation");
  });

  it("surfaces generator failures without falling back to a local ID", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "generation function failed" } });

    await expect(generateEmployeeBiometricId(input)).rejects.toThrow("Biometric ID could not be generated: generation function failed");
  });
});
