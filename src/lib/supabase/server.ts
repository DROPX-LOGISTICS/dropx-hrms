import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "dropx-hrms-auth";
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 8;

export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  const store = cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };

  const clear = (key: string) => {
    store.set(key, "", { ...options, maxAge: 0 });
    for (let index = 0; index < MAX_CHUNKS; index += 1) {
      const name = `${key}.${index}`;
      if (store.get(name) || index === 0) store.set(name, "", { ...options, maxAge: 0 });
    }
  };

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

  const write = (key: string, value: string) => {
    clear(key);
    if (value.length <= CHUNK_SIZE) {
      store.set(key, value, options);
      return;
    }
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    chunks.forEach((chunk, index) => store.set(`${key}.${index}`, chunk, options));
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
        setItem: (key, value) => {
          try { write(key, value); } catch { /* Cookie mutations can fail outside mutable contexts. */ }
        },
        removeItem: (key) => {
          try { clear(key); } catch { /* Cookie mutations can fail outside mutable contexts. */ }
        }
      }
    }
  });
}
