-- One-shot bootstrap for the shared DropX Supabase project.
-- Paste this entire file into Supabase → SQL Editor and run once.
-- Safe to re-run (IF NOT EXISTS / OR REPLACE / IF EXISTS guards).

begin;

-- Required by payroll triggers (normally created by hrms_foundation).
create or replace function public.hr_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- From 20260730100000_hr_payroll_process.sql
-- ---------------------------------------------------------------------------

alter table public.employees
  add column if not exists hr_pay_type text not null default 'monthly';

alter table public.employees
  drop constraint if exists employees_hr_pay_type_check;
alter table public.employees
  add constraint employees_hr_pay_type_check
  check (hr_pay_type in ('monthly', 'package'));

create index if not exists employees_hr_pay_type_idx
  on public.employees(company_id, hr_pay_type)
  where is_active;

create table if not exists public.hr_statutory_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  pf_enabled boolean not null default true,
  pf_employee_rate numeric(5,2) not null default 12,
  pf_employer_rate numeric(5,2) not null default 12,
  pf_wage_ceiling numeric(12,2) not null default 15000,
  esi_enabled boolean not null default true,
  esi_employee_rate numeric(5,2) not null default 0.75,
  esi_employer_rate numeric(5,2) not null default 3.25,
  esi_wage_ceiling numeric(12,2) not null default 21000,
  pt_enabled boolean not null default true,
  pt_slabs jsonb not null default '[]'::jsonb,
  tds_enabled boolean not null default false,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint hr_statutory_settings_pf_rate_check check (pf_employee_rate between 0 and 100 and pf_employer_rate between 0 and 100),
  constraint hr_statutory_settings_esi_rate_check check (esi_employee_rate between 0 and 100 and esi_employer_rate between 0 and 100),
  constraint hr_statutory_settings_pf_ceiling_check check (pf_wage_ceiling >= 0),
  constraint hr_statutory_settings_esi_ceiling_check check (esi_wage_ceiling >= 0),
  constraint hr_statutory_settings_pt_slabs_check check (jsonb_typeof(pt_slabs) = 'array')
);

insert into public.hr_statutory_settings(company_id)
select id from public.companies where is_active
on conflict (company_id) do nothing;

create table if not exists public.hr_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_month date not null,
  status text not null default 'draft',
  gross_total numeric(14,2) not null default 0,
  deduction_total numeric(14,2) not null default 0,
  employer_cost_total numeric(14,2) not null default 0,
  net_total numeric(14,2) not null default 0,
  payee_count integer not null default 0,
  created_by uuid,
  calculated_at timestamptz,
  locked_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_payroll_runs_period_check check (period_month = date_trunc('month', period_month)::date),
  constraint hr_payroll_runs_status_check check (status in ('draft', 'calculated', 'locked', 'paid', 'cancelled'))
);

create unique index if not exists hr_payroll_runs_company_period_idx
  on public.hr_payroll_runs(company_id, period_month)
  where status <> 'cancelled';
create index if not exists hr_payroll_runs_company_status_idx
  on public.hr_payroll_runs(company_id, status, period_month desc);

create table if not exists public.hr_pay_packages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payee_type text not null,
  payee_id uuid not null,
  title text not null,
  description text,
  amount numeric(14,2) not null,
  job_date date not null default current_date,
  status text not null default 'approved',
  payroll_run_id uuid references public.hr_payroll_runs(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_pay_packages_payee_type_check check (payee_type in ('employee', 'contractor')),
  constraint hr_pay_packages_title_check check (length(btrim(title)) >= 2),
  constraint hr_pay_packages_amount_check check (amount > 0),
  constraint hr_pay_packages_status_check check (status in ('draft', 'approved', 'included_in_run', 'paid', 'cancelled'))
);

create index if not exists hr_pay_packages_payee_idx
  on public.hr_pay_packages(company_id, payee_type, payee_id, status);
create index if not exists hr_pay_packages_run_idx
  on public.hr_pay_packages(payroll_run_id);
create index if not exists hr_pay_packages_unclaimed_idx
  on public.hr_pay_packages(company_id, payee_type, payee_id, job_date)
  where status = 'approved' and payroll_run_id is null;

create table if not exists public.hr_payroll_run_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null references public.hr_payroll_runs(id) on delete cascade,
  payee_type text not null,
  payee_id uuid not null,
  payee_name text not null,
  payee_code text,
  pay_type text not null,
  working_days numeric(5,2) not null default 0,
  present_days numeric(5,2) not null default 0,
  paid_leave_days numeric(5,2) not null default 0,
  lop_days numeric(5,2) not null default 0,
  lop_manual_override boolean not null default false,
  gross_earnings numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  employer_contributions numeric(14,2) not null default 0,
  net_pay numeric(14,2) not null default 0,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_payroll_run_lines_payee_type_check check (payee_type in ('employee', 'contractor')),
  constraint hr_payroll_run_lines_pay_type_check check (pay_type in ('monthly', 'package')),
  constraint hr_payroll_run_lines_status_check check (status in ('pending', 'calculated', 'excluded', 'error')),
  unique (run_id, payee_type, payee_id)
);

create index if not exists hr_payroll_run_lines_run_idx
  on public.hr_payroll_run_lines(run_id, payee_type, payee_name);

create table if not exists public.hr_payroll_run_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_line_id uuid not null references public.hr_payroll_run_lines(id) on delete cascade,
  payroll_head_id uuid references public.hr_payroll_heads(id) on delete set null,
  package_id uuid references public.hr_pay_packages(id) on delete set null,
  component_code text not null,
  component_name text not null,
  component_type text not null,
  amount numeric(14,2) not null default 0,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint hr_payroll_run_line_items_type_check check (component_type in ('earning', 'deduction', 'employer_contribution'))
);

create index if not exists hr_payroll_run_line_items_line_idx
  on public.hr_payroll_run_line_items(run_line_id, display_order);

create or replace function public.hr_validate_payee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payee_type = 'employee' then
    if not exists (select 1 from public.employees where id = new.payee_id and company_id = new.company_id) then
      raise exception 'Employee does not belong to the selected company';
    end if;
  elsif new.payee_type = 'contractor' then
    if not exists (select 1 from public.contractors where id = new.payee_id and company_id = new.company_id) then
      raise exception 'Contractor does not belong to the selected company';
    end if;
  else
    raise exception 'Unknown payee type';
  end if;
  return new;
end;
$$;

drop trigger if exists hr_pay_packages_validate_payee on public.hr_pay_packages;
create trigger hr_pay_packages_validate_payee
before insert or update on public.hr_pay_packages
for each row execute function public.hr_validate_payee();

drop trigger if exists hr_payroll_run_lines_validate_payee on public.hr_payroll_run_lines;
create trigger hr_payroll_run_lines_validate_payee
before insert or update on public.hr_payroll_run_lines
for each row execute function public.hr_validate_payee();

drop trigger if exists hr_statutory_settings_touch_updated_at on public.hr_statutory_settings;
create trigger hr_statutory_settings_touch_updated_at
before update on public.hr_statutory_settings
for each row execute function public.hr_touch_updated_at();

drop trigger if exists hr_payroll_runs_touch_updated_at on public.hr_payroll_runs;
create trigger hr_payroll_runs_touch_updated_at
before update on public.hr_payroll_runs
for each row execute function public.hr_touch_updated_at();

drop trigger if exists hr_pay_packages_touch_updated_at on public.hr_pay_packages;
create trigger hr_pay_packages_touch_updated_at
before update on public.hr_pay_packages
for each row execute function public.hr_touch_updated_at();

drop trigger if exists hr_payroll_run_lines_touch_updated_at on public.hr_payroll_run_lines;
create trigger hr_payroll_run_lines_touch_updated_at
before update on public.hr_payroll_run_lines
for each row execute function public.hr_touch_updated_at();

alter table public.hr_statutory_settings enable row level security;
alter table public.hr_payroll_runs enable row level security;
alter table public.hr_pay_packages enable row level security;
alter table public.hr_payroll_run_lines enable row level security;
alter table public.hr_payroll_run_line_items enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hr_statutory_settings',
    'hr_payroll_runs',
    'hr_pay_packages',
    'hr_payroll_run_lines',
    'hr_payroll_run_line_items'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'service_role_' || table_name || '_all'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
        'service_role_' || table_name || '_all',
        table_name
      );
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- From 20260807100000_hr_payroll_station_packages.sql
-- ---------------------------------------------------------------------------

alter table public.hr_payroll_run_lines
  add column if not exists location_id uuid references public.stations(id) on delete set null;

create index if not exists hr_payroll_run_lines_location_idx
  on public.hr_payroll_run_lines(run_id, location_id);

update public.hr_payroll_run_lines line
set location_id = employee.location_id
from public.employees employee
where line.payee_type = 'employee'
  and line.payee_id = employee.id
  and line.location_id is null;

update public.hr_payroll_run_lines line
set location_id = contractor.location_id
from public.contractors contractor
where line.payee_type = 'contractor'
  and line.payee_id = contractor.id
  and line.location_id is null;

create table if not exists public.hr_package_rate_defaults (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  package_type text not null,
  rate numeric(14,2) not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint hr_package_rate_defaults_type_check check (
    package_type in ('delivery_package', 'mfn_pickup', 'amazon_pickup', 'mfn_return')
  ),
  constraint hr_package_rate_defaults_rate_check check (rate >= 0),
  unique (company_id, package_type)
);

create table if not exists public.hr_package_rate_overrides (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payee_type text not null,
  payee_id uuid not null,
  package_type text not null,
  rate numeric(14,2) not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint hr_package_rate_overrides_payee_type_check check (payee_type in ('employee', 'contractor')),
  constraint hr_package_rate_overrides_type_check check (
    package_type in ('delivery_package', 'mfn_pickup', 'amazon_pickup', 'mfn_return')
  ),
  constraint hr_package_rate_overrides_rate_check check (rate >= 0),
  unique (company_id, payee_type, payee_id, package_type)
);

create table if not exists public.hr_payroll_package_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid not null references public.hr_payroll_runs(id) on delete cascade,
  run_line_id uuid not null references public.hr_payroll_run_lines(id) on delete cascade,
  payee_type text not null,
  payee_id uuid not null,
  package_type text not null,
  quantity numeric(12,2) not null default 0,
  rate numeric(14,2) not null default 0,
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_payroll_package_entries_payee_type_check check (payee_type in ('employee', 'contractor')),
  constraint hr_payroll_package_entries_type_check check (
    package_type in ('delivery_package', 'mfn_pickup', 'amazon_pickup', 'mfn_return')
  ),
  constraint hr_payroll_package_entries_quantity_check check (quantity >= 0),
  constraint hr_payroll_package_entries_rate_check check (rate >= 0),
  constraint hr_payroll_package_entries_amount_check check (amount >= 0),
  unique (run_line_id, package_type)
);

create index if not exists hr_payroll_package_entries_run_idx
  on public.hr_payroll_package_entries(run_id, run_line_id);

create index if not exists hr_package_rate_overrides_payee_idx
  on public.hr_package_rate_overrides(company_id, payee_type, payee_id);

insert into public.hr_package_rate_defaults (company_id, package_type, rate)
select company.id, package_type.type, 0
from public.companies company
cross join (
  values
    ('delivery_package'),
    ('mfn_pickup'),
    ('amazon_pickup'),
    ('mfn_return')
) as package_type(type)
where company.is_active
on conflict (company_id, package_type) do nothing;

drop trigger if exists hr_package_rate_defaults_touch_updated_at on public.hr_package_rate_defaults;
create trigger hr_package_rate_defaults_touch_updated_at
before update on public.hr_package_rate_defaults
for each row execute function public.hr_touch_updated_at();

drop trigger if exists hr_package_rate_overrides_touch_updated_at on public.hr_package_rate_overrides;
create trigger hr_package_rate_overrides_touch_updated_at
before update on public.hr_package_rate_overrides
for each row execute function public.hr_touch_updated_at();

drop trigger if exists hr_payroll_package_entries_touch_updated_at on public.hr_payroll_package_entries;
create trigger hr_payroll_package_entries_touch_updated_at
before update on public.hr_payroll_package_entries
for each row execute function public.hr_touch_updated_at();

drop trigger if exists hr_package_rate_overrides_validate_payee on public.hr_package_rate_overrides;
create trigger hr_package_rate_overrides_validate_payee
before insert or update on public.hr_package_rate_overrides
for each row execute function public.hr_validate_payee();

drop trigger if exists hr_payroll_package_entries_validate_payee on public.hr_payroll_package_entries;
create trigger hr_payroll_package_entries_validate_payee
before insert or update on public.hr_payroll_package_entries
for each row execute function public.hr_validate_payee();

alter table public.hr_package_rate_defaults enable row level security;
alter table public.hr_package_rate_overrides enable row level security;
alter table public.hr_payroll_package_entries enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hr_package_rate_defaults',
    'hr_package_rate_overrides',
    'hr_payroll_package_entries'
  ] loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = 'service_role_' || table_name || '_all'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')',
        'service_role_' || table_name || '_all',
        table_name
      );
    end if;
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
