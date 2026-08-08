import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null | undefined;

function readEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  try {
    // Runtime secrets/bindings on Cloudflare Workers
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as Record<string, string | undefined>;
    return env?.[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}

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
