begin;

do $migration$
declare
  function_definition text;
  previous_rule text := $rule$elsif item.head_type in ('employee_earning', 'statutory_contribution') then$rule$;
  complete_rule text := $rule$elsif item.head_type in ('employee_earning', 'employee_deduction', 'statutory_contribution', 'statutory_deduction') then$rule$;
begin
  select pg_get_functiondef(
    'public.hr_save_employee_salary_assignment(uuid,uuid,uuid,date,jsonb,uuid)'::regprocedure
  )
  into function_definition;

  if position(complete_rule in function_definition) > 0 then
    return;
  end if;
  if position(previous_rule in function_definition) = 0 then
    raise exception 'Unable to locate the existing CTC component reconciliation rule';
  end if;

  execute replace(function_definition, previous_rule, complete_rule);
end;
$migration$;

commit;
