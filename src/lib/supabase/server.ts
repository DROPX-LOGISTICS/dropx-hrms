import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { readEnv } from "@/lib/env";

const STORAGE_KEY = "dropx-hrms-auth";
const MAX_CHUNKS = 8;

/**
 * Server Components must treat auth cookies as read-only.
 * Calling cookies().set() during RSC render throws on Next/OpenNext (Workers → 500),
 * even when wrapped in try/catch in some runtimes. Session writes belong in
 * middleware / route handlers only.
 */
export function createServerSupabaseClient() {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) return null;
  const store = cookies();

  const read = (key: string) => {
    const legacy = store.get(key)?.value;
    if (legacy) return legacy;
    let value = "";
    for (let index = 0; index < MAX_CHUNKS; index += 1) {
      const chunk = store.get(`${key}.${index}`)?.value;
      if (!chunk) break;
      value += chunk;
    }
    return value || null;
  };

  return createClient(url, anonKey, {
    auth: {
      storageKey: STORAGE_KEY,
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => read(key),
        setItem: () => {
          /* no-op in RSC */
        },
        removeItem: () => {
          /* no-op in RSC */
        }
      }
    }
  });
}
