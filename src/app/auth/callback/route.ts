import { NextRequest, NextResponse } from "next/server";
import { AUTH_RETURN_COOKIE, resolveAuthReturnPath } from "@/lib/auth-navigation";
import {
  applyPendingAuthCookies,
  authCookieOptions,
  createRouteSupabaseClient
} from "@/lib/supabase/route-client";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = resolveAuthReturnPath(
    request.cookies.get(AUTH_RETURN_COOKIE)?.value,
    request.nextUrl.searchParams.get("next")
  );

  const finish = (path: string, pendingCookies: ReturnType<typeof createRouteSupabaseClient>["pendingCookies"] = []) => {
    const response = NextResponse.redirect(new URL(path, request.url));
    applyPendingAuthCookies(response, pendingCookies);
    response.cookies.set(AUTH_RETURN_COOKIE, "", {
      ...authCookieOptions,
      maxAge: 0
    });
    return response;
  };

  const { client, pendingCookies } = createRouteSupabaseClient(request);
  if (!code || !client) return finish("/login?reason=Authentication%20callback%20failed", pendingCookies);

  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return finish(`/login?reason=${encodeURIComponent(error.message)}`, pendingCookies);
  return finish(next, pendingCookies);
}
