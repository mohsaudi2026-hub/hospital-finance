-- ============================================================
-- Migration 021 — منظومة التسويات المالية بعد الإقفال الشهري
-- ============================================================

create table if not exists financial_adjustments (
  id                  uuid primary key default gen_random_uuid(),
  ref_number          text unique,
  facility_id         uuid not null references facilities(id) on delete cascade,
  month               date not null,                           -- الشهر المالي المراد تسويته
  record_type         text not null check (record_type in ('revenue','deduction','procurement','contract_payment')),
  original_record_id  uuid,                                    -- السجل الأصلي المُراد تسويته (اختياري)
  original_ref_number text,                                    -- الرقم المرجعي للسجل الأصلي إن وجد
  adjustment_type     text not null check (adjustment_type in ('increase','decrease','correction')),
  amount              numeric(14,2) not null check (amount <> 0), -- القيمة (موجبة أو سالبة)
  reason              text not null check (char_length(reason) >= 5),
  approved_by_admin   boolean not null default false,
  created_by          uuid not null references profiles(id),
  created_at          timestamptz not null default now()
);

-- RLS
alter table financial_adjustments enable row level security;

create policy "facility roles manage financial adjustments" on financial_adjustments
  for all using (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin']));

create policy "facility entry creates financial adjustments" on financial_adjustments
  for insert with check (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin','hospital_data_entry']));

create policy "facility and ministry read financial adjustments" on financial_adjustments
  for select using (user_has_role_for_facility(facility_id, array['super_admin','ministry_viewer','hospital_admin','hospital_data_entry','hospital_viewer']));

-- Trigger for ref_number in adjustments
create or replace function public.generate_ref_number_adjustments()
returns trigger language plpgsql as $$
declare
  v_code     text;
  v_year     text;
  v_month    text;
  v_sequence int;
begin
  select code into v_code from facilities where id = new.facility_id;
  v_year  := to_char(new.month, 'YYYY');
  v_month := to_char(new.month, 'MM');

  select coalesce(max(
    cast(split_part(ref_number, '-', 5) as int)
  ), 0) + 1
  into v_sequence
  from financial_adjustments
  where facility_id = new.facility_id
    and to_char(month,'YYYY-MM') = v_year || '-' || v_month
    and ref_number like v_code || '-ADJ-' || v_year || '-' || v_month || '-%';

  new.ref_number := v_code || '-ADJ-' || v_year || '-' || v_month || '-' || lpad(v_sequence::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_ref_financial_adjustments on public.financial_adjustments;
create trigger trg_ref_financial_adjustments
  before insert on financial_adjustments
  for each row execute procedure public.generate_ref_number_adjustments();

-- ربط التريجر بسجل التدقيق
drop trigger if exists trg_audit_financial_adjustments on public.financial_adjustments;
create trigger trg_audit_financial_adjustments
  after insert or update or delete on public.financial_adjustments
  for each row execute function public.log_financial_audit();

notify pgrst, 'reload schema';
