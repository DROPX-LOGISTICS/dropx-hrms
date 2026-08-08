"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_RETURN_COOKIE, AUTH_RETURN_TTL_SECONDS, resolveAuthReturnPath } from "@/lib/auth-navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function requestOrigin() {
  // Prefer explicit app URL so OAuth always returns to HRMS, not Partner Ops Site URL.
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;

  const requestHeaders = headers();
  const hostHeader = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = hostHeader.split(",")[0]?.trim() || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signInWithGoogle(formData: FormData) {
  const client = createServerSupabaseClient();
  if (!client) redirect("/login?reason=Authentication%20is%20not%20configured");
  const callback = new URL("/auth/callback", requestOrigin());
  cookies().set(AUTH_RETURN_COOKIE, resolveAuthReturnPath(formData.get("next")), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_RETURN_TTL_SECONDS
  });
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } }
  });
  if (error || !data.url) redirect(`/login?reason=${encodeURIComponent(error?.message ?? "Unable to start Google sign-in")}`);
  redirect(data.url);
}

export async function signOut() {
  const client = createServerSupabaseClient();
  if (client) await client.auth.signOut({ scope: "local" });
  redirect("/login");
}
