-- Ensure unique (company_id, code) exists so payroll head seeds / upserts work.
-- Run this BEFORE hr_payroll_heads.sql if you still want ON CONFLICT behavior.
-- Also safe if you use the updated seed (WHERE NOT EXISTS only).

begin;

-- Deduplicate any existing rows with the same company_id + code (keep oldest).
delete from public.hr_payroll_heads a
using public.hr_payroll_heads b
where a.company_id = b.company_id
  and a.code = b.code
  and a.id > b.id;

create unique index if not exists hr_payroll_heads_company_code_uidx
  on public.hr_payroll_heads (company_id, code);

commit;
