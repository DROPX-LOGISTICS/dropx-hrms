import { safeReturnPath } from "./validation";

export const AUTH_RETURN_COOKIE = "dropx-hrms-auth-return";
export const AUTH_RETURN_TTL_SECONDS = 10 * 60;

export function resolveAuthReturnPath(
  primary: FormDataEntryValue | null | undefined,
  fallback: FormDataEntryValue | null | undefined = null
) {
  return safeReturnPath(primary ?? fallback ?? null);
}
