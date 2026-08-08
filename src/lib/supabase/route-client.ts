import { type NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const AUTH_STORAGE_KEY = "dropx-hrms-auth";
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 8;

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30
};

export type PendingCookie = { name: string; value: string; maxAge: number };

function readChunked(get: (name: string) => string | undefined, key: string) {
  const legacy = get(key);
  if (legacy) return legacy;
  let value = "";
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const chunk = get(`${key}.${index}`);
    if (!chunk) break;
    value += chunk;
  }
  return value || null;
}

function queueClear(pending: PendingCookie[], key: string, request?: NextRequest) {
  pending.push({ name: key, value: "", maxAge: 0 });
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const name = `${key}.${index}`;
    // Only clear chunk cookies that already exist — avoids flooding Set-Cookie on Workers.
    if (!request || request.cookies.get(name)) {
      pending.push({ name, value: "", maxAge: 0 });
    }
  }
}

function queueWrite(pending: PendingCookie[], key: string, value: string, request?: NextRequest) {
  queueClear(pending, key, request);
  // Prefer a single cookie for small values (PKCE verifier). Chunk only when needed.
  if (value.length <= CHUNK_SIZE) {
    pending.push({ name: key, value, maxAge: authCookieOptions.maxAge });
    return;
  }
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
  chunks.forEach((chunk, index) => {
    pending.push({ name: `${key}.${index}`, value: chunk, maxAge: authCookieOptions.maxAge });
  });
}

/** Last write wins per cookie name — prevents Max-Age=0 from wiping a later value. */
export function applyPendingAuthCookies(response: NextResponse, pending: PendingCookie[]) {
  const byName = new Map<string, PendingCookie>();
  for (const cookie of pending) byName.set(cookie.name, cookie);
  for (const cookie of byName.values()) {
    response.cookies.set(cookie.name, cookie.value, { ...authCookieOptions, maxAge: cookie.maxAge });
  }
}

/**
 * Supabase client bound to a Route Handler request/response cookie jar.
 * In-memory overlay makes clears/writes visible mid-request (needed for PKCE).
 */
export function createRouteSupabaseClient(request: NextRequest): {
  client: SupabaseClient | null;
  pendingCookies: PendingCookie[];
  clearAuthSession: () => void;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const pendingCookies: PendingCookie[] = [];
  const memory = new Map<string, string>();
  const removed = new Set<string>();

  const clearAuthSession = () => {
    for (const key of [AUTH_STORAGE_KEY, `${AUTH_STORAGE_KEY}-code-verifier`]) {
      removed.add(key);
      memory.delete(key);
      queueClear(pendingCookies, key, request);
    }
  };

  if (!url || !anonKey) return { client: null, pendingCookies, clearAuthSession };

  const client = createClient(url, anonKey, {
    auth: {
      storageKey: AUTH_STORAGE_KEY,
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => {
          if (memory.has(key)) return memory.get(key) ?? null;
          if (removed.has(key)) return null;
          return readChunked((name) => request.cookies.get(name)?.value, key);
        },
        setItem: (key, value) => {
          removed.delete(key);
          memory.set(key, value);
          queueWrite(pendingCookies, key, value, request);
        },
        removeItem: (key) => {
          removed.add(key);
          memory.delete(key);
          queueClear(pendingCookies, key, request);
        }
      }
    }
  });

  return { client, pendingCookies, clearAuthSession };
}

/** Prefer the live request host for local dev so PKCE cookies and callback share an origin. */
export function oauthAppOrigin(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const hostname = host.split(",")[0]?.trim().split(":")[0] ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "http";
    return `${proto}://${host.split(",")[0]?.trim()}`;
  }
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return request.nextUrl.origin;
}
