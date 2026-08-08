"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signOut() {
  const client = createServerSupabaseClient();
  if (client) await client.auth.signOut({ scope: "local" });
  redirect("/login");
}
