import { NextRequest, NextResponse } from "next/server";
import {
  applyPendingAuthCookies,
  createRouteSupabaseClient
} from "@/lib/supabase/route-client";

export async function GET(request: NextRequest) {
  const { client, pendingCookies, clearAuthSession } = createRouteSupabaseClient(request);
  clearAuthSession();
  if (client) {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
  }
  const response = NextResponse.redirect(new URL("/login", request.url));
  applyPendingAuthCookies(response, pendingCookies);
  return response;
}
