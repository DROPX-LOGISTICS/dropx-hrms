begin;

create extension if not exists pgcrypto;

create table if not exists public.hr_exit_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  case_number_prefix text not null default 'EXIT',
  resignation_notice_days integer not null default 30,
  termination_notice_days integer not null default 0,
  settlement_due_days integer not null default 2,
  withdrawal_allowed boolean not null default true,
  auto_create_tasks boolean not null default true,
  auto_generate_documents boolean not null default false,
  signatory_name text,
  signatory_title text,
  registered_address text,
  footer_text text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint hr_exit_policies_prefix_check check (case_number_prefix ~ '^[A-Z0-9_-]{2,12}$'),
  constraint hr_exit_policies_days_check check (
    resignation_notice_days between 0 and 365 and
    termination_notice_days between 0 and 365 and
    settlement_due_days between 0 and 365
  )
);

create table if not exists public.hr_exit_reasons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scenario text not null,
  code text not null,
  name text not null,
  employee_selectable boolean not null default false,
  comment_required boolean not null default false,
  default_rehire_eligible boolean,
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_reasons_scenario_check check (scenario in ('resignation','termination','other')),
  constraint hr_exit_reasons_code_check check (code ~ '^[A-Z0-9_]{2,40}$'),
  unique(company_id, scenario, code)
);

create table if not exists public.hr_exit_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scenario text not null,
  code text not null,
  name text not null,
  step_order integer not null,
  approver_role text not null,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_workflow_scenario_check check (scenario in ('resignation','termination','all')),
  constraint hr_exit_workflow_code_check check (code ~ '^[A-Z0-9_]{2,40}$'),
  constraint hr_exit_workflow_role_check check (approver_role in ('REPORTING_MANAGER','HR_MANAGER','HRMS_ADMIN','OWNER')),
  unique(company_id, scenario, code),
  unique(company_id, scenario, step_order)
);

create table if not exists public.hr_exit_task_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scenario text not null default 'all',
  category text not null,
  code text not null,
  name text not null,
  instructions text,
  owner_role text not null,
  due_offset_days integer not null default 0,
  display_order integer not null default 100,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_task_template_scenario_check check (scenario in ('resignation','termination','all')),
  constraint hr_exit_task_template_category_check check (category in ('handover','clearance','settlement','compliance')),
  constraint hr_exit_task_template_code_check check (code ~ '^[A-Z0-9_]{2,40}$'),
  constraint hr_exit_task_template_role_check check (owner_role in ('EMPLOYEE','REPORTING_MANAGER','HR_MANAGER','HRMS_ADMIN','OWNER')),
  constraint hr_exit_task_template_offset_check check (due_offset_days between -365 and 365),
  unique(company_id, scenario, code)
);

create table if not exists public.hr_exit_document_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_type text not null,
  name text not null,
  title_template text not null,
  body_template text not null,
  generation_stage text not null default 'completion',
  version integer not null default 1,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_document_type_check check (document_type in ('resignation_acceptance','termination_letter','relieving_letter','experience_certificate','no_dues_certificate','settlement_statement')),
  constraint hr_exit_document_stage_check check (generation_stage in ('approval','completion')),
  unique(company_id, document_type, version)
);

create table if not exists public.hr_exit_notification_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  event_code text not null,
  name text not null,
  to_recipients text[] not null default '{}'::text[],
  cc_recipients text[] not null default '{}'::text[],
  custom_to_emails text[] not null default '{}'::text[],
  custom_cc_emails text[] not null default '{}'::text[],
  subject_template text not null,
  body_template text not null,
  is_enabled boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_notification_event_check check (event_code in ('CASE_SUBMITTED','CASE_APPROVED','CASE_REJECTED','WITHDRAWAL_REQUESTED','TASK_ASSIGNED','TASK_COMPLETED','DOCUMENTS_GENERATED','CASE_CLOSED')),
  constraint hr_exit_notification_to_recipient_check check (to_recipients <@ array['EMPLOYEE','REPORTING_MANAGER','HR_TEAM','HR_OWNER','TASK_OWNER']::text[]),
  constraint hr_exit_notification_cc_recipient_check check (cc_recipients <@ array['EMPLOYEE','REPORTING_MANAGER','HR_TEAM','HR_OWNER','TASK_OWNER']::text[]),
  unique(company_id, event_code)
);

create table if not exists public.hr_exit_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  counter_year integer not null,
  last_number integer not null default 0,
  primary key(company_id, counter_year)
);

create table if not exists public.hr_exit_cases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_number text not null,
  employee_id uuid not null references public.employees(id) on delete restrict,
  source text not null,
  scenario text not null,
  reason_id uuid references public.hr_exit_reasons(id) on delete restrict,
  employee_reason text,
  confidential_reason text,
  requested_last_working_date date,
  approved_last_working_date date,
  effective_date date,
  notice_days integer not null default 0,
  notice_shortfall_days integer not null default 0,
  status text not null default 'submitted',
  current_stage text not null default 'review',
  manager_user_id uuid,
  hr_owner_user_id uuid,
  personal_email text,
  personal_mobile text,
  rehire_eligible boolean,
  access_cutoff_at timestamptz,
  settlement_status text not null default 'not_started',
  settlement_approved_by uuid,
  settlement_approved_at timestamptz,
  submitted_by uuid,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  closed_by uuid,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_cases_source_check check (source in ('employee','hr')),
  constraint hr_exit_cases_scenario_check check (scenario in ('resignation','termination','other')),
  constraint hr_exit_cases_status_check check (status in ('submitted','under_review','approved','notice_period','clearance','ready_to_close','documents_ready','closed','rejected','withdrawal_requested','withdrawn','cancelled','on_hold')),
  constraint hr_exit_cases_stage_check check (current_stage in ('review','notice','handover','clearance','settlement','documents','closed')),
  constraint hr_exit_cases_settlement_check check (settlement_status in ('not_started','draft','approved','paid','not_applicable')),
  constraint hr_exit_cases_notice_check check (notice_days between 0 and 3650 and notice_shortfall_days between 0 and 3650),
  unique(company_id, case_number)
);

create unique index if not exists hr_exit_cases_one_open_employee_idx
  on public.hr_exit_cases(company_id, employee_id)
  where status not in ('closed','rejected','withdrawn','cancelled');

create table if not exists public.hr_exit_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid not null references public.hr_exit_cases(id) on delete cascade,
  workflow_step_id uuid references public.hr_exit_workflow_steps(id) on delete set null,
  step_order integer not null,
  step_name text not null,
  approver_role text not null,
  assigned_user_id uuid,
  is_required boolean not null default true,
  status text not null default 'pending',
  comments text,
  acted_by uuid,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_approvals_status_check check (status in ('pending','approved','rejected','skipped')),
  unique(case_id, step_order)
);

create table if not exists public.hr_exit_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid not null references public.hr_exit_cases(id) on delete cascade,
  template_id uuid references public.hr_exit_task_templates(id) on delete set null,
  category text not null,
  code text not null,
  name text not null,
  instructions text,
  owner_role text not null,
  owner_user_id uuid,
  due_date date,
  is_required boolean not null default true,
  status text not null default 'pending',
  completion_note text,
  completed_by uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_tasks_status_check check (status in ('pending','in_progress','completed','waived','blocked')),
  unique(case_id, code)
);

create table if not exists public.hr_exit_settlement_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid not null references public.hr_exit_cases(id) on delete cascade,
  code text not null,
  label text not null,
  item_type text not null,
  amount numeric(14,2) not null default 0,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_exit_settlement_type_check check (item_type in ('earning','deduction')),
  constraint hr_exit_settlement_amount_check check (amount >= 0),
  unique(case_id, code)
);

create table if not exists public.hr_exit_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid not null references public.hr_exit_cases(id) on delete cascade,
  template_id uuid references public.hr_exit_document_templates(id) on delete set null,
  document_type text not null,
  file_name text not null,
  storage_path text not null,
  template_version integer not null,
  status text not null default 'generated',
  generated_by uuid,
  generated_at timestamptz not null default now(),
  issued_at timestamptz,
  acknowledged_at timestamptz,
  constraint hr_exit_documents_status_check check (status in ('generated','issued','acknowledged','void')),
  unique(case_id, document_type, template_version)
);

create table if not exists public.hr_exit_events (
  id bigserial primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid not null references public.hr_exit_cases(id) on delete cascade,
  event_code text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  actor_user_id uuid,
  actor_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_exit_notification_log (
  id bigserial primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  case_id uuid not null references public.hr_exit_cases(id) on delete cascade,
  event_code text not null,
  to_emails text[] not null default '{}'::text[],
  cc_emails text[] not null default '{}'::text[],
  subject text not null,
  status text not null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint hr_exit_notification_log_status_check check (status in ('sent','skipped','failed'))
);

create index if not exists hr_exit_cases_company_status_idx on public.hr_exit_cases(company_id, status, submitted_at desc);
create index if not exists hr_exit_cases_employee_idx on public.hr_exit_cases(company_id, employee_id, submitted_at desc);
create index if not exists hr_exit_approvals_case_idx on public.hr_exit_approvals(case_id, step_order);
create index if not exists hr_exit_tasks_case_idx on public.hr_exit_tasks(case_id, category, status);
create index if not exists hr_exit_events_case_idx on public.hr_exit_events(case_id, created_at desc);
create index if not exists hr_exit_documents_case_idx on public.hr_exit_documents(case_id, generated_at desc);

create or replace function public.hr_next_exit_case_number(p_company_id uuid, p_prefix text default 'EXIT')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_year integer := extract(year from current_date)::integer;
  next_value integer;
begin
  insert into public.hr_exit_counters(company_id, counter_year, last_number)
  values (p_company_id, current_year, 1)
  on conflict(company_id, counter_year)
  do update set last_number = public.hr_exit_counters.last_number + 1
  returning last_number into next_value;
  return upper(p_prefix) || '-' || current_year::text || '-' || lpad(next_value::text, 5, '0');
end;
$$;

create or replace function public.hr_validate_exit_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists(select 1 from public.employees where id = new.employee_id and company_id = new.company_id) then
    raise exception 'Employee does not belong to the selected company';
  end if;
  if new.reason_id is not null and not exists(select 1 from public.hr_exit_reasons where id = new.reason_id and company_id = new.company_id and scenario in (new.scenario, 'other')) then
    raise exception 'Exit reason does not belong to the selected company';
  end if;
  return new;
end;
$$;

drop trigger if exists hr_exit_cases_validate_company on public.hr_exit_cases;
create trigger hr_exit_cases_validate_company before insert or update on public.hr_exit_cases for each row execute function public.hr_validate_exit_company();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hr_exit_policies','hr_exit_reasons','hr_exit_workflow_steps','hr_exit_task_templates',
    'hr_exit_document_templates','hr_exit_notification_templates','hr_exit_cases','hr_exit_approvals',
    'hr_exit_tasks','hr_exit_settlement_items'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.hr_touch_updated_at()', table_name || '_touch_updated_at', table_name);
  end loop;
end $$;

insert into public.hr_exit_policies(company_id)
select id from public.companies where is_active
on conflict(company_id) do nothing;

insert into public.hr_exit_reasons(company_id, scenario, code, name, employee_selectable, comment_required, default_rehire_eligible, display_order)
select company.id, defaults.scenario, defaults.code, defaults.name, defaults.employee_selectable, defaults.comment_required, defaults.rehire, defaults.sort
from public.companies company
cross join (values
  ('resignation','CAREER_GROWTH','Career growth',true,false,true,10),
  ('resignation','PERSONAL_REASONS','Personal reasons',true,true,true,20),
  ('resignation','HIGHER_STUDIES','Higher studies',true,false,true,30),
  ('resignation','RELOCATION','Relocation',true,false,true,40),
  ('resignation','OTHER_RESIGNATION','Other',true,true,null,100),
  ('termination','PERFORMANCE','Performance',false,true,false,10),
  ('termination','MISCONDUCT','Misconduct',false,true,false,20),
  ('termination','REDUNDANCY','Role redundancy / business decision',false,true,true,30),
  ('termination','PROBATION','Probation not confirmed',false,true,false,40),
  ('termination','OTHER_TERMINATION','Other',false,true,null,100)
) as defaults(scenario, code, name, employee_selectable, comment_required, rehire, sort)
where company.is_active
on conflict(company_id, scenario, code) do nothing;

insert into public.hr_exit_workflow_steps(company_id, scenario, code, name, step_order, approver_role)
select company.id, defaults.scenario, defaults.code, defaults.name, defaults.step_order, defaults.approver_role
from public.companies company
cross join (values
  ('resignation','MANAGER_REVIEW','Reporting manager review',10,'REPORTING_MANAGER'),
  ('resignation','HR_APPROVAL','HR approval',20,'HR_MANAGER'),
  ('termination','HR_APPROVAL','HR approval',10,'HR_MANAGER'),
  ('termination','OWNER_APPROVAL','Authorised leadership approval',20,'OWNER')
) as defaults(scenario, code, name, step_order, approver_role)
where company.is_active
on conflict(company_id, scenario, code) do nothing;

insert into public.hr_exit_task_templates(company_id, scenario, category, code, name, instructions, owner_role, due_offset_days, display_order)
select company.id, defaults.scenario, defaults.category, defaults.code, defaults.name, defaults.instructions, defaults.owner_role, defaults.due_offset, defaults.sort
from public.companies company
cross join (values
  ('all','handover','WORK_HANDOVER','Complete work and responsibility handover','Attach or reference the handover note in the completion comment.','EMPLOYEE',-3,10),
  ('all','handover','MANAGER_HANDOVER_ACCEPTANCE','Manager accepts work handover','Confirm responsibilities, files and pending items have been transferred.','REPORTING_MANAGER',-2,20),
  ('all','clearance','ASSET_CLEARANCE','Company assets returned','Confirm laptop, phone, ID card, keys and other assigned assets.','HR_MANAGER',0,30),
  ('all','clearance','IT_ACCESS_CLEARANCE','Disable system access','Confirm access is disabled at the configured cutoff.','HRMS_ADMIN',0,40),
  ('all','settlement','PAYROLL_CLEARANCE','Prepare final settlement','Confirm payable and recoverable amounts are entered and approved.','HR_MANAGER',1,50),
  ('all','compliance','STATUTORY_CLEARANCE','Complete statutory records','Confirm applicable PF, ESI and payroll exit records.','HR_MANAGER',1,60)
) as defaults(scenario, category, code, name, instructions, owner_role, due_offset, sort)
where company.is_active
on conflict(company_id, scenario, code) do nothing;

insert into public.hr_exit_document_templates(company_id, document_type, name, title_template, body_template, generation_stage)
select company.id, defaults.document_type, defaults.name, defaults.title, defaults.body, defaults.stage
from public.companies company
cross join (values
  ('resignation_acceptance','Resignation acceptance','Resignation Acceptance','Date: {{generated_date}}\n\nDear {{employee_name}},\n\nThis is to acknowledge and accept your resignation from the position of {{designation}}. Your last working date is {{last_working_date}}. Please complete all handover and clearance requirements.\n\nWe thank you for your contribution to {{company_name}} and wish you well.','approval'),
  ('termination_letter','Termination letter','Employment Separation Notice','Date: {{generated_date}}\n\nDear {{employee_name}},\n\nThis letter confirms that your employment as {{designation}} with {{company_name}} will end effective {{last_working_date}}. The recorded separation reason is {{exit_reason}}. Final dues, if any, will be processed after the required clearances.','approval'),
  ('relieving_letter','Relieving letter','Relieving Letter','Date: {{generated_date}}\n\nTO WHOM IT MAY CONCERN\n\nThis is to confirm that {{employee_name}} (Employee ID: {{employee_code}}) was relieved from duties as {{designation}} at the close of business on {{last_working_date}}, after completing the applicable exit formalities.','completion'),
  ('experience_certificate','Experience certificate','Experience Certificate','Date: {{generated_date}}\n\nTO WHOM IT MAY CONCERN\n\nThis is to certify that {{employee_name}} (Employee ID: {{employee_code}}) worked with {{company_name}} as {{designation}} from {{date_of_joining}} to {{last_working_date}}.\n\nWe wish {{employee_name}} success in future endeavours.','completion'),
  ('no_dues_certificate','No-dues certificate','No-Dues Certificate','Date: {{generated_date}}\n\nThis certifies that the configured clearance steps for {{employee_name}} ({{employee_code}}) have been completed as recorded in the HRMS exit case {{case_number}}.','completion'),
  ('settlement_statement','Settlement statement','Full and Final Settlement Statement','Employee: {{employee_name}}\nEmployee ID: {{employee_code}}\nExit case: {{case_number}}\nLast working date: {{last_working_date}}\n\n{{settlement_lines}}\n\nNet settlement: {{settlement_net}}\nStatus: {{settlement_status}}','completion')
) as defaults(document_type, name, title, body, stage)
where company.is_active
on conflict(company_id, document_type, version) do nothing;

insert into public.hr_exit_notification_templates(company_id, event_code, name, to_recipients, cc_recipients, subject_template, body_template)
select company.id, defaults.event_code, defaults.name, defaults.to_recipients, defaults.cc_recipients, defaults.subject, defaults.body
from public.companies company
cross join (values
  ('CASE_SUBMITTED','Exit request submitted',array['HR_TEAM','REPORTING_MANAGER']::text[],array['EMPLOYEE']::text[],'{{case_number}} - exit request submitted','An exit request for {{employee_name}} ({{employee_code}}) has been submitted. Requested last working date: {{requested_last_working_date}}. Open the HRMS to review it.'),
  ('CASE_APPROVED','Exit request approved',array['EMPLOYEE','HR_TEAM']::text[],array['REPORTING_MANAGER']::text[],'{{case_number}} - exit request approved','The exit request for {{employee_name}} is approved. Last working date: {{last_working_date}}. Clearance and handover tasks are now available.'),
  ('CASE_REJECTED','Exit request rejected',array['EMPLOYEE','HR_TEAM']::text[],array['REPORTING_MANAGER']::text[],'{{case_number}} - exit request rejected','The exit request for {{employee_name}} has been rejected. Please open the HRMS for the review comments.'),
  ('WITHDRAWAL_REQUESTED','Withdrawal requested',array['HR_TEAM','REPORTING_MANAGER']::text[],array['EMPLOYEE']::text[],'{{case_number}} - withdrawal requested','{{employee_name}} has requested withdrawal of the exit request. Open the HRMS to review it.'),
  ('TASK_ASSIGNED','Exit task assigned',array['TASK_OWNER']::text[],array['HR_TEAM']::text[],'{{case_number}} - exit task assigned','The exit task "{{task_name}}" for {{employee_name}} is assigned to you and is due on {{task_due_date}}.'),
  ('TASK_COMPLETED','Exit task completed',array['HR_TEAM']::text[],array['REPORTING_MANAGER']::text[],'{{case_number}} - exit task completed','The task "{{task_name}}" for {{employee_name}} has been completed.'),
  ('DOCUMENTS_GENERATED','Exit documents ready',array['EMPLOYEE','HR_TEAM']::text[],array['REPORTING_MANAGER']::text[],'{{case_number}} - exit documents ready','Exit documents for {{employee_name}} have been generated and are available in DropX People.'),
  ('CASE_CLOSED','Exit case closed',array['EMPLOYEE','HR_TEAM']::text[],array['REPORTING_MANAGER']::text[],'{{case_number}} - exit completed','The exit case for {{employee_name}} has been completed and closed.')
) as defaults(event_code, name, to_recipients, cc_recipients, subject, body)
where company.is_active
on conflict(company_id, event_code) do nothing;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('hr-exit-documents','hr-exit-documents',false,10485760,array['application/pdf'])
on conflict(id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf'];

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'hr_exit_policies','hr_exit_reasons','hr_exit_workflow_steps','hr_exit_task_templates',
    'hr_exit_document_templates','hr_exit_notification_templates','hr_exit_counters','hr_exit_cases',
    'hr_exit_approvals','hr_exit_tasks','hr_exit_settlement_items','hr_exit_documents','hr_exit_events',
    'hr_exit_notification_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    if not exists(select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = 'service_role_' || table_name || '_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', 'service_role_' || table_name || '_all', table_name);
    end if;
  end loop;
end $$;

commit;
