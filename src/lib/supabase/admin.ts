import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readEnv } from "@/lib/env";

let cached: SupabaseClient | null | undefined;

/** Resolve service-role client at request time (Cloudflare secrets load per-request). */
export function getSupabaseAdmin(): SupabaseClient | null {
  // Never permanently cache a miss — Workers may resolve secrets after first touch.
  if (cached) return cached;
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  cached = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return cached;
}

export function isAdminConfigured() {
  return Boolean(readEnv("NEXT_PUBLIC_SUPABASE_URL") && readEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

/**
 * Lazy proxy so existing `supabaseAdmin.from(...)` call sites keep working.
 * Prefer `getSupabaseAdmin()` for null checks — this proxy is always truthy.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseAdmin();
    if (!client) {
      throw new Error("Database configuration is missing.");
    }
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  }
});
