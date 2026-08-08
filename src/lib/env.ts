/**
 * Read env without Next.js inlining `process.env.NEXT_PUBLIC_*` at build time.
 *
 * Manual `pnpm deploy` has `.env`, so static access gets baked in correctly.
 * GitHub / Workers Builds often has no Build variables, so
 * `process.env.NEXT_PUBLIC_FOO` is replaced with `""` in the bundle forever —
 * even when Cloudflare runtime secrets are set. Dynamic `process.env[name]`
 * plus Workers context keeps those secrets working.
 */
export function readEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;
  try {
    // Optional fallback when OpenNext has not mirrored bindings onto process.env yet.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCloudflareContext } = require("@opennextjs/cloudflare") as typeof import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as Record<string, string | undefined>;
    return env?.[name]?.trim() || undefined;
  } catch {
    return undefined;
  }
}
