-- Fix shared-DB hr_payroll_heads + hr_user_access so seeds and access grants work.
-- Run this once in Supabase SQL Editor, then re-run access grant / heads seed as needed.

begin;

create extension if not exists pgcrypto;

-- id must auto-generatea
alter table public.hr_payroll_heads
  alter column id set default gen_random_uuid();

alter table public.hr_user_access
  alter column id set default gen_random_uuid();

alter table public.hr_user_access
  alter column created_at set default now();

alter table public.hr_user_access
  alter column updated_at set default now();

alter table public.hr_user_access
  alter column location_ids set default '{}'::uuid[];

-- backfill any null ids
update public.hr_payroll_heads
set id = gen_random_uuid()
where id is null;

update public.hr_user_access
set id = gen_random_uuid()
where id is null;

update public.hr_user_access
set created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now()),
    location_ids = coalesce(location_ids, '{}'::uuid[]);

-- unique (company_id, code)
delete from public.hr_payroll_heads a
using public.hr_payroll_heads b
where a.company_id = b.company_id
  and a.code = b.code
  and a.ctid > b.ctid;

create unique index if not exists hr_payroll_heads_company_code_uidx
  on public.hr_payroll_heads (company_id, code);

-- hr_user_access unique for upserts
create unique index if not exists hr_user_access_company_user_uidx
  on public.hr_user_access (company_id, user_id);

commit;
