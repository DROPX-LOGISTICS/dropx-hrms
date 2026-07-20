import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STORAGE_KEY = "dropx-hrms-auth";
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 8;

export function createServerSupabaseClient() {
  if (!url || !anonKey) return null;
  const store = cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };

  const clear = () => {
    store.set(STORAGE_KEY, "", { ...options, maxAge: 0 });
    for (let index = 0; index < MAX_CHUNKS; index += 1) {
      store.set(`${STORAGE_KEY}.${index}`, "", { ...options, maxAge: 0 });
    }
  };

  const read = () => {
    const legacy = store.get(STORAGE_KEY)?.value;
    if (legacy) return legacy;
    let value = "";
    for (let index = 0; index < MAX_CHUNKS; index += 1) {
      const chunk = store.get(`${STORAGE_KEY}.${index}`)?.value;
      if (!chunk) break;
      value += chunk;
    }
    return value || null;
  };

  const write = (value: string) => {
    clear();
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    chunks.forEach((chunk, index) => store.set(`${STORAGE_KEY}.${index}`, chunk, options));
  };

  return createClient(url, anonKey, {
    auth: {
      storageKey: STORAGE_KEY,
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: () => read(),
        setItem: (_key, value) => {
          try { write(value); } catch { /* Middleware refreshes server sessions. */ }
        },
        removeItem: () => {
          try { clear(); } catch { /* Middleware refreshes server sessions. */ }
        }
      }
    }
  });
}
