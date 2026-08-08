import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Lightweight probe for Cloudflare runtime/build env (no secret values returned). */
export async function GET() {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_URL",
    "SUPABASE_SERVICE_ROLE_KEY"
  ] as const;

  const present: Record<string, boolean> = {};
  for (const name of names) {
    let value = process.env[name]?.trim();
    if (!value) {
      try {
        const { getCloudflareContext } = await import("@opennextjs/cloudflare");
        const env = getCloudflareContext().env as Record<string, string | undefined>;
        value = env?.[name]?.trim();
      } catch {
        value = undefined;
      }
    }
    present[name] = Boolean(value);
  }

  const ok = present.NEXT_PUBLIC_SUPABASE_URL && present.NEXT_PUBLIC_SUPABASE_ANON_KEY && present.SUPABASE_SERVICE_ROLE_KEY;
  return NextResponse.json(
    {
      ok,
      present,
      hint: ok
        ? "Runtime env looks complete."
        : "Set missing keys in Cloudflare → Worker → Settings → Variables and Secrets (and Build variables for NEXT_PUBLIC_*)."
    },
    { status: ok ? 200 : 503 }
  );
}
