import { NextRequest, NextResponse } from "next/server";
import { AUTH_RETURN_COOKIE, resolveAuthReturnPath } from "@/lib/auth-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = resolveAuthReturnPath(
    request.cookies.get(AUTH_RETURN_COOKIE)?.value,
    request.nextUrl.searchParams.get("next")
  );
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    response.cookies.set(AUTH_RETURN_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
    return response;
  };
  const client = createServerSupabaseClient();
  if (!code || !client) return finish("/login?reason=Authentication%20callback%20failed");
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return finish(`/login?reason=${encodeURIComponent(error.message)}`);
  return finish(next);
}
