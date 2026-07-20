import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeReturnPath(request.nextUrl.searchParams.get("next"));
  const client = createServerSupabaseClient();
  if (!code || !client) return NextResponse.redirect(new URL("/login?reason=Authentication%20callback%20failed", request.url));
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?reason=${encodeURIComponent(error.message)}`, request.url));
  return NextResponse.redirect(new URL(next, request.url));
}
