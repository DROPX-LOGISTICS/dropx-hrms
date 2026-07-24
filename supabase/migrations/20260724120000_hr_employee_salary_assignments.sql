begin;

create table if not exists public.hr_employee_salary_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  configuration_id uuid not null references public.hr_salary_configurations(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_employee_salary_assignments_dates_check
    check (effective_to is null or effective_to >= effective_from),
  unique (employee_id, effective_from)
);

create unique index if not exists hr_employee_salary_assignments_current_idx
  on public.hr_employee_salary_assignments(company_id, employee_id)
  where effective_to is null;

create index if not exists hr_employee_salary_assignments_employee_dates_idx
  on public.hr_employee_salary_assignments(company_id, employee_id, effective_from desc);

create table if not exists public.hr_employee_salary_values (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  assignment_id uuid not null references public.hr_employee_salary_assignments(id) on delete cascade,
  payroll_head_id uuid not null references public.hr_payroll_heads(id) on delete restrict,
  amount numeric(14,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_employee_salary_values_amount_check check (amount >= 0),
  unique (assignment_id, payroll_head_id)
);

create index if not exists hr_employee_salary_values_assignment_idx
  on public.hr_employee_salary_values(assignment_id, payroll_head_id);

create or replace function public.hr_validate_employee_salary_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.employees
    where id = new.employee_id and company_id = new.company_id
  ) then
    raise exception 'Employee does not belong to the selected company';
  end if;
  if not exists (
    select 1 from public.hr_salary_configurations
    where id = new.configuration_id and company_id = new.company_id
  ) then
    raise exception 'Salary configuration does not belong to the selected company';
  end if;
  return new;
end;
$$;

drop trigger if exists hr_employee_salary_assignments_validate_company
  on public.hr_employee_salary_assignments;
create trigger hr_employee_salary_assignments_validate_company
before insert or update on public.hr_employee_salary_assignments
for each row execute function public.hr_validate_employee_salary_assignment();

create or replace function public.hr_validate_employee_salary_value()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.hr_employee_salary_assignments assignment
    join public.hr_salary_configuration_items item
      on item.configuration_id = assignment.configuration_id
     and item.payroll_head_id = new.payroll_head_id
     and item.calculation_type = 'input'
     and item.is_enabled
    where assignment.id = new.assignment_id
      and assignment.company_id = new.company_id
  ) then
    raise exception 'Employee salary value is not a custom input in the selected configuration';
  end if;
  return new;
end;
$$;

drop trigger if exists hr_employee_salary_values_validate_company
  on public.hr_employee_salary_values;
create trigger hr_employee_salary_values_validate_company
before insert or update on public.hr_employee_salary_values
for each row execute function public.hr_validate_employee_salary_value();

drop trigger if exists hr_employee_salary_assignments_touch_updated_at
  on public.hr_employee_salary_assignments;
create trigger hr_employee_salary_assignments_touch_updated_at
before update on public.hr_employee_salary_assignments
for each row execute function public.hr_touch_updated_at();

drop trigger if exists hr_employee_salary_values_touch_updated_at
  on public.hr_employee_salary_values;
create trigger hr_employee_salary_values_touch_updated_at
before update on public.hr_employee_salary_values
for each row execute function public.hr_touch_updated_at();

create or replace function public.hr_save_employee_salary_assignment(
  p_company_id uuid,
  p_employee_id uuid,
  p_configuration_id uuid,
  p_effective_from date,
  p_values jsonb,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_assignment public.hr_employee_salary_assignments%rowtype;
  saved_assignment_id uuid;
  item record;
  value_amount numeric(14,2);
  value_key text;
  safe_values jsonb := coalesce(p_values, '{}'::jsonb);
begin
  if p_effective_from is null then
    raise exception 'Effective date is required';
  end if;
  if jsonb_typeof(safe_values) is distinct from 'object' then
    raise exception 'Employee salary values must be an object';
  end if;
  if not exists (
    select 1 from public.employees
    where id = p_employee_id and company_id = p_company_id
  ) then
    raise exception 'Employee was not found';
  end if;
  if not exists (
    select 1 from public.hr_salary_configurations
    where id = p_configuration_id
      and company_id = p_company_id
      and is_active
      and effective_from <= p_effective_from
      and (effective_to is null or effective_to >= p_effective_from)
  ) then
    raise exception 'Select an active salary configuration for the effective date';
  end if;

  select *
  into current_assignment
  from public.hr_employee_salary_assignments
  where company_id = p_company_id
    and employee_id = p_employee_id
    and effective_to is null
  for update;

  if current_assignment.id is not null and p_effective_from < current_assignment.effective_from then
    raise exception 'Effective date cannot be earlier than the current salary assignment';
  end if;

  if current_assignment.id is not null and p_effective_from = current_assignment.effective_from then
    update public.hr_employee_salary_assignments
    set configuration_id = p_configuration_id,
        created_by = coalesce(p_actor_user_id, created_by),
        updated_at = now()
    where id = current_assignment.id
    returning id into saved_assignment_id;
    delete from public.hr_employee_salary_values where assignment_id = saved_assignment_id;
  else
    if current_assignment.id is not null then
      update public.hr_employee_salary_assignments
      set effective_to = p_effective_from - 1,
          updated_at = now()
      where id = current_assignment.id;
    end if;
    insert into public.hr_employee_salary_assignments(
      company_id, employee_id, configuration_id, effective_from, created_by
    )
    values (
      p_company_id, p_employee_id, p_configuration_id, p_effective_from, p_actor_user_id
    )
    returning id into saved_assignment_id;
  end if;

  for value_key in select jsonb_object_keys(safe_values)
  loop
    if not exists (
      select 1
      from public.hr_salary_configuration_items salary_item
      where salary_item.company_id = p_company_id
        and salary_item.configuration_id = p_configuration_id
        and salary_item.payroll_head_id::text = value_key
        and salary_item.calculation_type = 'input'
        and salary_item.is_enabled
    ) then
      raise exception 'A salary value was supplied for an invalid payroll head';
    end if;
  end loop;

  for item in
    select salary_item.payroll_head_id, salary_item.minimum_value, salary_item.maximum_value,
           payroll_head.name
    from public.hr_salary_configuration_items salary_item
    join public.hr_payroll_heads payroll_head on payroll_head.id = salary_item.payroll_head_id
    where salary_item.company_id = p_company_id
      and salary_item.configuration_id = p_configuration_id
      and salary_item.calculation_type = 'input'
      and salary_item.is_enabled
    order by salary_item.display_order
  loop
    if not (safe_values ? item.payroll_head_id::text) then
      raise exception '% requires an employee value', item.name;
    end if;
    begin
      value_amount := (safe_values ->> item.payroll_head_id::text)::numeric;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception '% must be a valid amount', item.name;
    end;
    if value_amount < 0 then
      raise exception '% cannot be negative', item.name;
    end if;
    if item.minimum_value is not null and value_amount < item.minimum_value then
      raise exception '% cannot be lower than %', item.name, item.minimum_value;
    end if;
    if item.maximum_value is not null and value_amount > item.maximum_value then
      raise exception '% cannot be higher than %', item.name, item.maximum_value;
    end if;
    insert into public.hr_employee_salary_values(
      company_id, assignment_id, payroll_head_id, amount
    )
    values (
      p_company_id, saved_assignment_id, item.payroll_head_id, value_amount
    );
  end loop;

  insert into public.hr_audit_log(
    company_id, actor_user_id, entity_type, entity_id, action, after_data
  )
  values (
    p_company_id,
    p_actor_user_id,
    'employee_salary_assignment',
    saved_assignment_id,
    'save',
    jsonb_build_object(
      'employee_id', p_employee_id,
      'configuration_id', p_configuration_id,
      'effective_from', p_effective_from,
      'values', safe_values
    )
  );

  return saved_assignment_id;
end;
$$;

revoke all on function public.hr_save_employee_salary_assignment(uuid, uuid, uuid, date, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.hr_save_employee_salary_assignment(uuid, uuid, uuid, date, jsonb, uuid)
  to service_role;

alter table public.hr_employee_salary_assignments enable row level security;
alter table public.hr_employee_salary_values enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hr_employee_salary_assignments',
    'hr_employee_salary_values'
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
