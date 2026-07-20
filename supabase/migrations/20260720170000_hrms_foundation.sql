begin;

create extension if not exists pgcrypto;

create table if not exists public.hr_user_access (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null,
  location_ids uuid[] not null default '{}'::uuid[],
  all_locations boolean not null default false,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_user_access_role_check check (role_code in ('HRMS_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE', 'VIEWER')),
  unique (company_id, user_id)
);

create table if not exists public.hr_company_settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  work_week text[] not null default array['mon','tue','wed','thu','fri','sat']::text[],
  attendance_grace_minutes integer not null default 15,
  full_day_minutes integer not null default 480,
  half_day_minutes integer not null default 240,
  leave_year_start_month integer not null default 1,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint hr_company_settings_work_week_check check (work_week <@ array['mon','tue','wed','thu','fri','sat','sun']::text[] and cardinality(work_week) > 0),
  constraint hr_company_settings_grace_check check (attendance_grace_minutes between 0 and 180),
  constraint hr_company_settings_full_day_check check (full_day_minutes between 60 and 1440),
  constraint hr_company_settings_half_day_check check (half_day_minutes between 30 and 720),
  constraint hr_company_settings_leave_month_check check (leave_year_start_month between 1 and 12)
);

create table if not exists public.hr_leave_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text not null,
  annual_allowance integer not null default 0,
  color text not null default '#1f7a50',
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_leave_types_code_check check (code ~ '^[A-Z0-9_]{2,20}$'),
  constraint hr_leave_types_allowance_check check (annual_allowance between 0 and 365),
  constraint hr_leave_types_color_check check (color ~ '^#[0-9A-Fa-f]{6}$'),
  unique (company_id, code)
);

create table if not exists public.hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  leave_type_id uuid not null references public.hr_leave_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  days integer generated always as ((end_date - start_date) + 1) stored,
  reason text not null,
  status text not null default 'pending',
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  updated_at timestamptz not null default now(),
  constraint hr_leave_requests_period_check check (end_date >= start_date),
  constraint hr_leave_requests_reason_check check (length(btrim(reason)) >= 3),
  constraint hr_leave_requests_status_check check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  constraint hr_leave_requests_review_check check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (status in ('approved','rejected') and reviewed_by is not null and reviewed_at is not null)
    or status = 'cancelled'
  )
);

create table if not exists public.hr_audit_log (
  id bigserial primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hr_user_access_company_active_idx on public.hr_user_access(company_id, is_active);
create index if not exists hr_leave_types_company_active_idx on public.hr_leave_types(company_id, is_active);
create index if not exists hr_leave_requests_company_status_idx on public.hr_leave_requests(company_id, status, requested_at desc);
create index if not exists hr_leave_requests_employee_dates_idx on public.hr_leave_requests(company_id, employee_id, start_date desc);
create index if not exists hr_audit_log_company_created_idx on public.hr_audit_log(company_id, created_at desc);

create or replace function public.hr_validate_leave_company()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from public.employees where id = new.employee_id and company_id = new.company_id) then
    raise exception 'Employee does not belong to the selected company';
  end if;
  if not exists (select 1 from public.hr_leave_types where id = new.leave_type_id and company_id = new.company_id and (tg_op = 'UPDATE' or is_active)) then
    raise exception 'Leave type does not belong to the selected company or is inactive';
  end if;
  return new;
end;
$$;

drop trigger if exists hr_leave_requests_validate_company on public.hr_leave_requests;
create trigger hr_leave_requests_validate_company before insert or update on public.hr_leave_requests for each row execute function public.hr_validate_leave_company();

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

drop trigger if exists hr_user_access_touch_updated_at on public.hr_user_access;
create trigger hr_user_access_touch_updated_at before update on public.hr_user_access for each row execute function public.hr_touch_updated_at();
drop trigger if exists hr_leave_types_touch_updated_at on public.hr_leave_types;
create trigger hr_leave_types_touch_updated_at before update on public.hr_leave_types for each row execute function public.hr_touch_updated_at();
drop trigger if exists hr_leave_requests_touch_updated_at on public.hr_leave_requests;
create trigger hr_leave_requests_touch_updated_at before update on public.hr_leave_requests for each row execute function public.hr_touch_updated_at();

create or replace function public.hr_log_leave_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.hr_audit_log(company_id, actor_user_id, entity_type, entity_id, action, before_data)
    values (old.company_id, coalesce(old.reviewed_by, old.requested_by), 'leave_request', old.id, 'delete', to_jsonb(old));
    return old;
  end if;

  insert into public.hr_audit_log(company_id, actor_user_id, entity_type, entity_id, action, before_data, after_data)
  values (new.company_id, coalesce(new.reviewed_by, new.requested_by), 'leave_request', new.id, lower(tg_op), case when tg_op = 'UPDATE' then to_jsonb(old) else null end, to_jsonb(new));
  return new;
end;
$$;

drop trigger if exists hr_leave_requests_audit on public.hr_leave_requests;
create trigger hr_leave_requests_audit after insert or update or delete on public.hr_leave_requests for each row execute function public.hr_log_leave_change();

insert into public.hr_company_settings(company_id)
select id from public.companies where is_active
on conflict (company_id) do nothing;

insert into public.hr_leave_types(company_id, name, code, annual_allowance, color)
select company.id, defaults.name, defaults.code, defaults.allowance, defaults.color
from public.companies company
cross join (values
  ('Casual Leave', 'CASUAL', 12, '#1f7a50'),
  ('Sick Leave', 'SICK', 12, '#b33c36'),
  ('Earned Leave', 'EARNED', 15, '#315fa3')
) as defaults(name, code, allowance, color)
where company.is_active
on conflict (company_id, code) do nothing;

alter table public.hr_user_access enable row level security;
alter table public.hr_company_settings enable row level security;
alter table public.hr_leave_types enable row level security;
alter table public.hr_leave_requests enable row level security;
alter table public.hr_audit_log enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['hr_user_access','hr_company_settings','hr_leave_types','hr_leave_requests','hr_audit_log'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = table_name and policyname = 'service_role_' || table_name || '_all') then
      execute format('create policy %I on public.%I for all using (auth.role() = ''service_role'') with check (auth.role() = ''service_role'')', 'service_role_' || table_name || '_all', table_name);
    end if;
  end loop;
end $$;

commit;
