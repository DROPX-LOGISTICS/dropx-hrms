# DropX HRMS

Independent HRMS frontend for DropX Logistics. It deploys as its own Vercel project and uses the existing DropX Supabase project without changing the partner-dashboard application.

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
