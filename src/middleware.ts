import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STORAGE_KEY = "dropx-hrms-auth";
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 8;

function cookieOptions(secure: boolean, maxAge = 60 * 60 * 24 * 30) {
  return { httpOnly: true, sameSite: "lax" as const, secure, path: "/", maxAge };
}

function clearKey(request: NextRequest, response: NextResponse, key: string, secure: boolean) {
  const options = cookieOptions(secure, 0);
  request.cookies.set(key, "");
  response.cookies.set(key, "", options);
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const name = `${key}.${index}`;
    if (request.cookies.get(name) || index === 0) {
      request.cookies.set(name, "");
      response.cookies.set(name, "", options);
    }
  }
}

function clearAllAuthCookies(request: NextRequest, response: NextResponse, secure: boolean) {
  clearKey(request, response, STORAGE_KEY, secure);
  clearKey(request, response, `${STORAGE_KEY}-code-verifier`, secure);
}

function readAuthStorage(request: NextRequest, key: string) {
  const legacy = request.cookies.get(key)?.value;
  if (legacy) return legacy;
  let value = "";
  for (let index = 0; index < MAX_CHUNKS; index += 1) {
    const chunk = request.cookies.get(`${key}.${index}`)?.value;
    if (!chunk) break;
    value += chunk;
  }
  return value || null;
}

function writeAuthStorage(request: NextRequest, response: NextResponse, key: string, value: string, secure: boolean) {
  const options = cookieOptions(secure);
  clearKey(request, response, key, secure);
  if (value.length <= CHUNK_SIZE) {
    request.cookies.set(key, value);
    response.cookies.set(key, value, options);
    return;
  }
  const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
  chunks.forEach((chunk, index) => {
    const name = `${key}.${index}`;
    request.cookies.set(name, chunk);
    response.cookies.set(name, chunk, options);
  });
}

function redirectToLogin(request: NextRequest, clearCookies = false) {
  const login = new URL("/login", request.url);
  if (request.nextUrl.pathname !== "/") {
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  }
  const response = NextResponse.redirect(login);
  if (clearCookies) clearAllAuthCookies(request, response, process.env.NODE_ENV === "production");
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/auth/") || path.startsWith("/api/") || path.startsWith("/_next/") || path.includes(".")) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL("/login?reason=Authentication%20is%20not%20configured", request.url));
  }

  const secure = process.env.NODE_ENV === "production";
  const response = NextResponse.next();
  const hasStoredSession = Boolean(readAuthStorage(request, STORAGE_KEY) || readAuthStorage(request, `${STORAGE_KEY}.0`));

  const client = createClient(url, anonKey, {
    auth: {
      storageKey: STORAGE_KEY,
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: {
        getItem: (key) => readAuthStorage(request, key),
        setItem: (key, value) => {
          try {
            writeAuthStorage(request, response, key, value, secure);
          } catch {
            /* Cookie writes can fail in edge contexts; page auth still validates. */
          }
        },
        removeItem: (key) => {
          try {
            clearKey(request, response, key, secure);
          } catch {
            /* ignore */
          }
        }
      }
    }
  });

  try {
    // Stale/corrupt refresh tokens must not crash the Worker with a 500 on `/`.
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) return redirectToLogin(request, Boolean(error || hasStoredSession));
    return response;
  } catch {
    return redirectToLogin(request, true);
  }
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"] };
