"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeReturnPath } from "@/lib/validation";

function requestOrigin() {
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signInWithGoogle(formData: FormData) {
  const client = createServerSupabaseClient();
  if (!client) redirect("/login?reason=Authentication%20is%20not%20configured");
  const callback = new URL("/auth/callback", requestOrigin());
  callback.searchParams.set("next", safeReturnPath(formData.get("next")));
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
