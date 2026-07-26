begin;

-- Dashboard owns the workforce schema. This migration is intentionally
-- additive/idempotent so HRMS can use the same company data without changing
-- the employee, field executive, vendor, or worker workflows.
create table if not exists public.contractors
  (like public.field_executives including all);

alter table public.contractors
  add column if not exists profile_return_remarks text,
  add column if not exists profile_returned_at timestamptz;

alter table public.contractors enable row level security;

do $$
begin
  if to_regclass('public.profile_document_trash') is not null then
    alter table public.profile_document_trash
      drop constraint if exists profile_document_trash_owner_type_check;
    alter table public.profile_document_trash
      add constraint profile_document_trash_owner_type_check
      check (owner_type in ('employee', 'field_executive', 'contractor', 'vendor', 'worker'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'contractors_company_id_fkey'
      and conrelid = 'public.contractors'::regclass
  ) then
    alter table public.contractors
      add constraint contractors_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete cascade;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'contractors_location_id_fkey'
      and conrelid = 'public.contractors'::regclass
  ) then
    alter table public.contractors
      add constraint contractors_location_id_fkey
      foreign key (location_id) references public.stations(id);
  end if;
end
$$;

create table if not exists public.connect_profile_verifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  profile_type text not null,
  account_id uuid not null,
  kind text not null,
  input_key text not null,
  verified boolean not null default false,
  manual_review boolean not null default false,
  block_submit boolean not null default false,
  display_name text,
  message text,
  details jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, profile_type, account_id, kind)
);

alter table public.connect_profile_verifications
  drop constraint if exists connect_profile_verifications_profile_type_check;
alter table public.connect_profile_verifications
  add constraint connect_profile_verifications_profile_type_check
  check (profile_type in ('employee', 'field_executive', 'contractor', 'vendor', 'worker'));

alter table public.connect_profile_verifications
  drop constraint if exists connect_profile_verifications_kind_check;
alter table public.connect_profile_verifications
  add constraint connect_profile_verifications_kind_check
  check (kind in ('pan', 'pan_aadhaar', 'dl', 'vehicle', 'bank', 'pf_uan'));

create index if not exists connect_profile_verifications_account_idx
  on public.connect_profile_verifications(company_id, profile_type, account_id);

alter table public.connect_profile_verifications enable row level security;
drop policy if exists service_role_connect_profile_verifications_all
  on public.connect_profile_verifications;
create policy service_role_connect_profile_verifications_all
  on public.connect_profile_verifications
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

alter table public.biometric_enrolments
  add column if not exists profile_type text,
  add column if not exists account_id uuid;

alter table public.biometric_enrolments
  drop constraint if exists biometric_enrolments_profile_type_check;
alter table public.biometric_enrolments
  add constraint biometric_enrolments_profile_type_check
  check (
    profile_type is null
    or profile_type in ('employee', 'field_executive', 'contractor', 'vendor', 'worker')
  );

alter table public.biometric_enrolments
  drop constraint if exists biometric_enrolments_one_person_check;
alter table public.biometric_enrolments
  add constraint biometric_enrolments_one_person_check
  check (
    (
      worker_type = 'employee'
      and employee_id is not null
      and field_executive_id is null
    )
    or (
      worker_type = 'individual_contract'
      and employee_id is null
      and (
        field_executive_id is not null
        or (
          profile_type in ('contractor', 'vendor', 'worker')
          and account_id is not null
        )
      )
    )
  ) not valid;

update public.biometric_enrolments
set profile_type = case
      when employee_id is not null then 'employee'
      when field_executive_id is not null then 'field_executive'
      else profile_type
    end,
    account_id = coalesce(account_id, employee_id, field_executive_id)
where (employee_id is not null or field_executive_id is not null)
  and (profile_type is null or account_id is null);

create index if not exists biometric_enrolments_profile_account_idx
  on public.biometric_enrolments(company_id, profile_type, account_id);

commit;

notify pgrst, 'reload schema';
