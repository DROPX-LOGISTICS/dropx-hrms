begin;

-- Snapshot station on each payroll line for station-first browsing.
alter table public.hr_payroll_run_lines
  add column if not exists location_id uuid references public.stations(id) on delete set null;

create index if not exists hr_payroll_run_lines_location_idx
  on public.hr_payroll_run_lines(run_id, location_id);

-- Backfill from payee masters where possible.
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

-- Company-wide default rates for structured package types.
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

-- Per-member rate overrides (optional).
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

-- Structured package counts × rates for a payroll line.
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

-- Seed zero defaults for every active company.
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
