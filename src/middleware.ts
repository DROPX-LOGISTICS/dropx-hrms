import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const STORAGE_KEY = "dropx-hrms-auth";
const CHUNK_SIZE = 3000;
const MAX_CHUNKS = 8;

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/login" || path.startsWith("/auth/") || path.startsWith("/api/") || path.startsWith("/_next/") || path.includes(".")) return NextResponse.next();
  if (!url || !anonKey) return NextResponse.redirect(new URL("/login?reason=Authentication%20is%20not%20configured", request.url));

  const response = NextResponse.next();
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 };
  const clear = (key: string) => {
    request.cookies.set(key, "");
    response.cookies.set(key, "", { ...options, maxAge: 0 });
    for (let index = 0; index < MAX_CHUNKS; index += 1) {
      const name = `${key}.${index}`;
      request.cookies.set(name, "");
      response.cookies.set(name, "", { ...options, maxAge: 0 });
    }
  };
  const read = (key: string) => {
    const legacy = request.cookies.get(key)?.value;
    if (legacy) return legacy;
    let value = "";
    for (let index = 0; index < MAX_CHUNKS; index += 1) {
      const chunk = request.cookies.get(`${key}.${index}`)?.value;
      if (!chunk) break;
      value += chunk;
    }
    return value || null;
  };
  const write = (key: string, value: string) => {
    clear(key);
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "g")) ?? [];
    chunks.forEach((chunk, index) => {
      const name = `${key}.${index}`;
      request.cookies.set(name, chunk);
      response.cookies.set(name, chunk, options);
    });
  };

  const client = createClient(url, anonKey, {
    auth: {
      storageKey: STORAGE_KEY,
      flowType: "pkce",
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: true,
      storage: { getItem: read, setItem: write, removeItem: clear }
    }
  });
  // Reading a valid session is local; Supabase only makes a refresh request when
  // the token needs it. Protected pages still call getUser() for authoritative
  // server-side identity validation.
  const { data } = await client.auth.getSession();
  if (!data.session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"] };
