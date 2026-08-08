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

Also set the same names as `.env.example` in **both**:

1. **Build variables and secrets** (so `NEXT_PUBLIC_*` can be inlined at build time)
2. **Worker runtime** Variables / Secrets (`SUPABASE_SERVICE_ROLE_KEY`, etc.)

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
