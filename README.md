# DropX HRMS

Independent HRMS frontend for DropX Logistics. It deploys to **Cloudflare Workers** via OpenNext and uses the existing DropX Supabase project without changing the partner-dashboard application.

## Cloudflare Workers Builds (GitHub)

GitHub deploys must use the OpenNext commands — **not** bare `wrangler deploy` or `pnpm build` alone. Wrong CI settings overwrite a good manual deploy and commonly cause authenticated `/` **500**s (missing OpenNext output and/or wiped runtime vars).

In the Worker → **Settings → Builds**:

| Setting | Value |
| --- | --- |
| **Build command** | `pnpm run cf:build` |
| **Deploy command** | `pnpm run cf:deploy` |

`cf:build` runs OpenNext with `--dangerouslyUseUnsupportedNextVersion` (required on Next 14). `cf:deploy` passes `--keep-vars` so dashboard vars/secrets are not deleted on each Git push.

**Critical:** also add these under **Build variables and secrets** (same values as Worker secrets). Without them, Next can mis-build auth. This app also forces `dynamic = "force-dynamic"` on HRMS routes so CI cannot statically prerender pages that read cookies (that mismatch is a common GitHub-only 500).

| Build + runtime |
| --- |
| `NEXT_PUBLIC_SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `NEXT_PUBLIC_APP_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` |

Local equivalent of a good deploy:

```bash
pnpm run deploy
```

## Initial live scope

- Google authentication with a host-only HRMS session cookie
- company and location scoped authorization
- live overview metrics
- employee directory, employee creation, profile viewing, and active/inactive control
- biometric attendance register with date and location filters
- leave requests and approval workflow
- HR settings and leave-type administration

Field executives remain in the partner dashboard. Contractor support will use a dedicated HRMS table in a later release.

## Local setup

Copy `.env.example` to `.env.local`, add the Supabase anon and service-role keys, then run:

```bash
pnpm install
pnpm dev
```

Apply `supabase/migrations/20260720170000_hrms_foundation.sql` before enabling leave, approvals, or settings in production.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The service-role key is server-only. Never expose it with a `NEXT_PUBLIC_` prefix.
