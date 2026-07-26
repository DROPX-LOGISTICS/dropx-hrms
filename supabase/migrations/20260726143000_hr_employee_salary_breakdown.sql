begin;

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
     and item.is_enabled
    where assignment.id = new.assignment_id
      and assignment.company_id = new.company_id
  ) then
    raise exception 'Employee salary value is not enabled in the selected configuration';
  end if;
  return new;
end;
$$;

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
  monthly_ctc numeric(14,2);
  ctc_component_total numeric(14,2) := 0;
  component_difference numeric(14,2);
  difference_direction text;
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

  for value_key in select jsonb_object_keys(safe_values)
  loop
    if not exists (
      select 1
      from public.hr_salary_configuration_items salary_item
      where salary_item.company_id = p_company_id
        and salary_item.configuration_id = p_configuration_id
        and salary_item.payroll_head_id::text = value_key
        and salary_item.is_enabled
    ) then
      raise exception 'A salary value was supplied for an invalid payroll head';
    end if;
  end loop;

  for item in
    select salary_item.payroll_head_id,
           salary_item.minimum_value,
           salary_item.maximum_value,
           payroll_head.name,
           payroll_head.code,
           payroll_head.head_type
    from public.hr_salary_configuration_items salary_item
    join public.hr_payroll_heads payroll_head on payroll_head.id = salary_item.payroll_head_id
    where salary_item.company_id = p_company_id
      and salary_item.configuration_id = p_configuration_id
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
    if item.head_type = 'ctc' or upper(item.code) = 'CTC' then
      monthly_ctc := value_amount;
    elsif item.head_type in ('employee_earning', 'statutory_contribution') then
      ctc_component_total := ctc_component_total + value_amount;
    end if;
  end loop;

  if monthly_ctc is null then
    raise exception 'The salary configuration does not contain CTC';
  end if;
  component_difference := round(ctc_component_total - monthly_ctc, 2);
  if abs(component_difference) > 0.01 then
    difference_direction := case when component_difference > 0 then 'above' else 'below' end;
    raise exception 'CTC components total %, which is % % Monthly CTC %. Adjust the component values manually.',
      round(ctc_component_total, 2),
      abs(component_difference),
      difference_direction,
      round(monthly_ctc, 2);
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

  for item in
    select salary_item.payroll_head_id
    from public.hr_salary_configuration_items salary_item
    where salary_item.company_id = p_company_id
      and salary_item.configuration_id = p_configuration_id
      and salary_item.is_enabled
    order by salary_item.display_order
  loop
    value_amount := (safe_values ->> item.payroll_head_id::text)::numeric;
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
      'monthly_values', safe_values,
      'ctc_component_total', ctc_component_total
    )
  );

  return saved_assignment_id;
end;
$$;

revoke all on function public.hr_save_employee_salary_assignment(uuid, uuid, uuid, date, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.hr_save_employee_salary_assignment(uuid, uuid, uuid, date, jsonb, uuid)
  to service_role;

commit;
