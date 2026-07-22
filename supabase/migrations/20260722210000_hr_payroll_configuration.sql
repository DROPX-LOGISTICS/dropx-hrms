begin;

create table if not exists public.hr_payroll_heads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  head_type text not null,
  is_system boolean not null default false,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_payroll_heads_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  constraint hr_payroll_heads_name_check check (length(btrim(name)) between 2 and 80),
  constraint hr_payroll_heads_type_check check (head_type in ('ctc','earning','deduction','employer_contribution','reimbursement')),
  constraint hr_payroll_heads_system_check check (not is_system or code in ('CTC','BASIC_SALARY')),
  constraint hr_payroll_heads_order_check check (display_order between 0 and 9999),
  unique (company_id, code)
);

create table if not exists public.hr_salary_configurations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  effective_from date not null default current_date,
  effective_to date,
  annualisation_factor integer not null default 12,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_salary_configurations_code_check check (code ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  constraint hr_salary_configurations_name_check check (length(btrim(name)) between 2 and 80),
  constraint hr_salary_configurations_dates_check check (effective_to is null or effective_to >= effective_from),
  constraint hr_salary_configurations_factor_check check (annualisation_factor between 1 and 365),
  unique (company_id, code)
);

create unique index if not exists hr_salary_configurations_one_default_idx
  on public.hr_salary_configurations(company_id) where is_default;

create table if not exists public.hr_salary_configuration_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  configuration_id uuid not null references public.hr_salary_configurations(id) on delete cascade,
  payroll_head_id uuid not null references public.hr_payroll_heads(id) on delete restrict,
  calculation_type text not null,
  formula text,
  fixed_amount numeric(14,2),
  is_enabled boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_salary_configuration_items_type_check check (calculation_type in ('input','fixed','formula')),
  constraint hr_salary_configuration_items_value_check check (
    (calculation_type = 'input' and formula is null and fixed_amount is null)
    or (calculation_type = 'fixed' and formula is null and fixed_amount >= 0)
    or (calculation_type = 'formula' and length(btrim(formula)) between 1 and 250 and fixed_amount is null)
  ),
  constraint hr_salary_configuration_items_order_check check (display_order between 0 and 9999),
  unique (configuration_id, payroll_head_id)
);

create index if not exists hr_payroll_heads_company_active_idx on public.hr_payroll_heads(company_id, is_active, display_order);
create index if not exists hr_salary_configurations_company_active_idx on public.hr_salary_configurations(company_id, is_active, effective_from desc);
create index if not exists hr_salary_configuration_items_config_idx on public.hr_salary_configuration_items(configuration_id, display_order);

create or replace function public.hr_protect_system_payroll_head()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.is_system then
    if tg_op = 'DELETE' then raise exception 'System payroll heads cannot be deleted'; end if;
    if new.company_id is distinct from old.company_id
      or new.code is distinct from old.code
      or new.name is distinct from old.name
      or new.head_type is distinct from old.head_type
      or new.is_system is distinct from old.is_system
      or new.is_active is distinct from old.is_active then
      raise exception 'System payroll heads cannot be changed or deactivated';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists hr_payroll_heads_protect_system on public.hr_payroll_heads;
create trigger hr_payroll_heads_protect_system before update or delete on public.hr_payroll_heads
for each row execute function public.hr_protect_system_payroll_head();

create or replace function public.hr_validate_salary_configuration_item()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.hr_salary_configurations where id = new.configuration_id and company_id = new.company_id) then
    raise exception 'Salary configuration does not belong to the selected company';
  end if;
  if not exists (select 1 from public.hr_payroll_heads where id = new.payroll_head_id and company_id = new.company_id) then
    raise exception 'Payroll head does not belong to the selected company';
  end if;
  return new;
end;
$$;

drop trigger if exists hr_salary_configuration_items_validate_company on public.hr_salary_configuration_items;
create trigger hr_salary_configuration_items_validate_company before insert or update on public.hr_salary_configuration_items
for each row execute function public.hr_validate_salary_configuration_item();

drop trigger if exists hr_payroll_heads_touch_updated_at on public.hr_payroll_heads;
create trigger hr_payroll_heads_touch_updated_at before update on public.hr_payroll_heads
for each row execute function public.hr_touch_updated_at();
drop trigger if exists hr_salary_configurations_touch_updated_at on public.hr_salary_configurations;
create trigger hr_salary_configurations_touch_updated_at before update on public.hr_salary_configurations
for each row execute function public.hr_touch_updated_at();
drop trigger if exists hr_salary_configuration_items_touch_updated_at on public.hr_salary_configuration_items;
create trigger hr_salary_configuration_items_touch_updated_at before update on public.hr_salary_configuration_items
for each row execute function public.hr_touch_updated_at();

create or replace function public.hr_seed_payroll_company(target_company_id uuid, actor_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ctc_id uuid;
  basic_id uuid;
  target_configuration_id uuid;
begin
  insert into public.hr_payroll_heads(company_id, code, name, head_type, is_system, display_order, created_by)
  values (target_company_id, 'CTC', 'CTC', 'ctc', true, 10, actor_user_id)
  on conflict (company_id, code) do update set is_active = true
  returning id into ctc_id;

  insert into public.hr_payroll_heads(company_id, code, name, head_type, is_system, display_order, created_by)
  values (target_company_id, 'BASIC_SALARY', 'Basic Salary', 'earning', true, 20, actor_user_id)
  on conflict (company_id, code) do update set is_active = true
  returning id into basic_id;

  insert into public.hr_salary_configurations(company_id, code, name, description, is_default, created_by)
  values (target_company_id, 'DEFAULT', 'Default Salary Configuration', 'Base payroll structure. Change the equations to match company policy.', true, actor_user_id)
  on conflict (company_id, code) do update set is_active = true
  returning id into target_configuration_id;

  insert into public.hr_salary_configuration_items(company_id, configuration_id, payroll_head_id, calculation_type, display_order)
  values (target_company_id, target_configuration_id, ctc_id, 'input', 10)
  on conflict (configuration_id, payroll_head_id) do nothing;

  insert into public.hr_salary_configuration_items(company_id, configuration_id, payroll_head_id, calculation_type, formula, display_order)
  values (target_company_id, target_configuration_id, basic_id, 'formula', 'CTC * 50%', 20)
  on conflict (configuration_id, payroll_head_id) do nothing;
end;
$$;

create or replace function public.hr_seed_payroll_company_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then perform public.hr_seed_payroll_company(new.id, null); end if;
  return new;
end;
$$;

drop trigger if exists hr_companies_seed_payroll on public.companies;
create trigger hr_companies_seed_payroll after insert or update of is_active on public.companies
for each row when (new.is_active) execute function public.hr_seed_payroll_company_trigger();

select public.hr_seed_payroll_company(id, null) from public.companies where is_active;

alter table public.hr_payroll_heads enable row level security;
alter table public.hr_salary_configurations enable row level security;
alter table public.hr_salary_configuration_items enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['hr_payroll_heads','hr_salary_configurations','hr_salary_configuration_items'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = 'service_role_' || table_name || '_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', 'service_role_' || table_name || '_all', table_name);
    end if;
  end loop;
end $$;

commit;
