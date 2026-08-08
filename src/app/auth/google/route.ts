import { NextRequest, NextResponse } from "next/server";
import { AUTH_RETURN_COOKIE, AUTH_RETURN_TTL_SECONDS, resolveAuthReturnPath } from "@/lib/auth-navigation";
import {
  applyPendingAuthCookies,
  authCookieOptions,
  createRouteSupabaseClient,
  oauthAppOrigin
} from "@/lib/supabase/route-client";

/** Starts Google OAuth via a Route Handler (avoids Server Action redirect 500s on Cloudflare Workers). */
export async function GET(request: NextRequest) {
  const next = resolveAuthReturnPath(request.nextUrl.searchParams.get("next"));
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?reason=${encodeURIComponent(reason)}`, request.url));

  const { client, pendingCookies, clearAuthSession } = createRouteSupabaseClient(request);
  if (!client) return fail("Authentication is not configured");

  // Drop stale session/refresh cookies so PKCE is not poisoned by an old refresh token.
  clearAuthSession();

  const callback = new URL("/auth/callback", oauthAppOrigin(request));
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } }
  });
  if (error || !data.url) return fail(error?.message ?? "Unable to start Google sign-in");

  const response = NextResponse.redirect(data.url);
  applyPendingAuthCookies(response, pendingCookies);
  response.cookies.set(AUTH_RETURN_COOKIE, next, {
    ...authCookieOptions,
    maxAge: AUTH_RETURN_TTL_SECONDS
  });
  return response;
}
