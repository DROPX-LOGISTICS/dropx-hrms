begin;

alter table public.hr_payroll_heads disable trigger hr_payroll_heads_protect_system;

alter table public.hr_payroll_heads
  drop constraint if exists hr_payroll_heads_type_check,
  drop constraint if exists hr_payroll_heads_system_check;

update public.hr_payroll_heads
set
  name = 'Cost to the company',
  head_type = 'ctc',
  is_system = true,
  is_active = true
where code = 'CTC';

update public.hr_payroll_heads
set
  head_type = case head_type
    when 'earning' then 'employee_earning'
    when 'deduction' then 'employee_deduction'
    when 'employer_contribution' then 'statutory_contribution'
    when 'reimbursement' then 'employee_earning'
    else head_type
  end,
  is_system = false
where code <> 'CTC';

alter table public.hr_payroll_heads
  add constraint hr_payroll_heads_type_check
    check (head_type in ('ctc','employee_earning','employee_deduction','statutory_deduction','statutory_contribution')),
  add constraint hr_payroll_heads_system_check
    check (
      (code = 'CTC' and name = 'Cost to the company' and head_type = 'ctc' and is_system)
      or
      (code <> 'CTC' and head_type <> 'ctc' and not is_system)
    );

create or replace function public.hr_protect_system_payroll_head()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.code = 'CTC' or old.is_system then
    if tg_op = 'DELETE' then raise exception 'CTC payroll head cannot be deleted'; end if;
    if new.company_id is distinct from old.company_id
      or new.code is distinct from old.code
      or new.name is distinct from old.name
      or new.head_type is distinct from old.head_type
      or new.is_system is distinct from old.is_system
      or new.is_active is distinct from old.is_active then
      raise exception 'CTC payroll head cannot be changed or deactivated';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

alter table public.hr_payroll_heads enable trigger hr_payroll_heads_protect_system;

alter table public.hr_salary_configuration_items
  add column if not exists value_expression text,
  add column if not exists minimum_value numeric(14,2),
  add column if not exists maximum_value numeric(14,2);

update public.hr_salary_configuration_items
set value_expression = case
  when calculation_type = 'formula' then formula
  when calculation_type = 'fixed' then fixed_amount::text
  else null
end
where value_expression is null;

alter table public.hr_salary_configuration_items
  drop constraint if exists hr_salary_configuration_items_expression_check,
  drop constraint if exists hr_salary_configuration_items_range_check;

alter table public.hr_salary_configuration_items
  add constraint hr_salary_configuration_items_expression_check
    check (value_expression is null or length(btrim(value_expression)) between 1 and 250),
  add constraint hr_salary_configuration_items_range_check
    check (
      (minimum_value is null or minimum_value >= 0)
      and (maximum_value is null or maximum_value >= 0)
      and (minimum_value is null or maximum_value is null or maximum_value >= minimum_value)
    );

create or replace function public.hr_seed_payroll_company(target_company_id uuid, actor_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hr_payroll_heads(company_id, code, name, head_type, is_system, display_order, created_by)
  values (target_company_id, 'CTC', 'Cost to the company', 'ctc', true, 10, actor_user_id)
  on conflict (company_id, code) do update
    set name = excluded.name,
        head_type = excluded.head_type,
        is_system = true,
        is_active = true;
end;
$$;

select public.hr_seed_payroll_company(id, null) from public.companies where is_active;

commit;
