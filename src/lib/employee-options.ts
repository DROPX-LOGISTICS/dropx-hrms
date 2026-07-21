export type EmployeeLocationOption = {
  id: string;
  station_code: string;
  station_name: string | null;
  location_model_id: string | null;
};

export type EmployeeDesignationOption = {
  id: string;
  code: string;
  name: string;
  model_ids: string[] | null;
  onboarding_categories: string[] | null;
};

export function normalizeDesignationCategories(value: string[] | null | undefined) {
  return value?.length ? value : ["employees"];
}

export function isEmployeeDesignation(designation: EmployeeDesignationOption) {
  return normalizeDesignationCategories(designation.onboarding_categories).includes("employees");
}

export function employeeDesignationsForLocation(
  designations: EmployeeDesignationOption[],
  location: EmployeeLocationOption | undefined
) {
  if (!location) return [];
  return designations.filter((designation) => {
    if (!isEmployeeDesignation(designation)) return false;
    const modelIds = designation.model_ids ?? [];
    return modelIds.length === 0 || Boolean(location.location_model_id && modelIds.includes(location.location_model_id));
  });
}
