export const PACKAGE_TYPES = [
  "delivery_package",
  "mfn_pickup",
  "amazon_pickup",
  "mfn_return"
] as const;

export type PackageType = (typeof PACKAGE_TYPES)[number];

export const PACKAGE_TYPE_LABELS: Record<PackageType, string> = {
  delivery_package: "Delivery package",
  mfn_pickup: "MFN pickup",
  amazon_pickup: "Amazon pickup",
  mfn_return: "MFN return package"
};

export function isPackageType(value: string): value is PackageType {
  return (PACKAGE_TYPES as readonly string[]).includes(value);
}
