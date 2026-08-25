-- ============================================================
-- Migration 003 — Phase 3: المصروفات (هيئة شراء + عقود + سداد)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. PROCUREMENT ORDERS — هيئة شراء (إذن تسليم مسعّر)
-- ─────────────────────────────────────────────
create table if not exists procurement_orders (
  id             uuid primary key default gen_random_uuid(),
  ref_number     text unique,
  facility_id    uuid not null references facilities(id),
  month          date not null,
  order_date     date not null check (order_date <= current_date),
  order_number   text not null,
  value          numeric(14,2) not null check (value > 0),
  item_type      text not null check (item_type in ('دواء','مستلزمات')),
  funding_source text not null check (funding_source in ('خزانة','صندوق')),
  created_by     uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  unique (facility_id, order_number)
);

create trigger trg_lock_procurement
  before insert or update on procurement_orders
  for each row execute procedure public.prevent_write_to_closed_month();

-- ─────────────────────────────────────────────
-- 2. CONTRACTS — العقود (5 أنواع)
-- ─────────────────────────────────────────────
create table if not exists contracts (
  id                 uuid primary key default gen_random_uuid(),
  facility_id        uuid not null references facilities(id),
  contract_type      text not null check (contract_type in (
                       'security','cleaning','maintenance','patient_food','staff_food'
                     )),
  company_name       text not null check (char_length(company_name) >= 3),
  start_date         date not null,
  duration_months    int not null check (duration_months > 0),
  individual_value   numeric(14,2) not null check (individual_value >= 0),
  supervisor_value   numeric(14,2) not null default 0 check (supervisor_value >= 0),
  total_individuals  int not null check (total_individuals >= 0),
  total_supervisors  int not null default 0 check (total_supervisors >= 0),
  total_contract_value numeric(14,2) not null check (total_contract_value > 0),
  -- الإجمالي المُقترَح = (individual_value×total_individuals + supervisor_value×total_supervisors) × duration_months
  -- لكن يُقبل تعديل يدوي ليطابق نص العقد الرسمي
  is_active          boolean not null default true,
  created_by         uuid not null references profiles(id),
  created_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 3. CONTRACT PAYMENTS — السداد الشهري لكل عقد
-- ─────────────────────────────────────────────
create table if not exists contract_payments (
  id          uuid primary key default gen_random_uuid(),
  ref_number  text unique,
  contract_id uuid not null references contracts(id) on delete cascade,
  facility_id uuid not null references facilities(id),  -- مكرر عمداً لتسهيل RLS
  month       date not null,
  amount_paid numeric(14,2) not null check (amount_paid > 0),
  notes       text check (char_length(notes) <= 500),
  created_by  uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  unique (contract_id, month)
);

create trigger trg_lock_contract_payments
  before insert or update on contract_payments
  for each row execute procedure public.prevent_write_to_closed_month();

-- ─────────────────────────────────────────────
-- 4. Trigger: ref_number للمصروفات
-- ─────────────────────────────────────────────
create or replace function public.generate_ref_number_expenses()
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
    cast(split_part(ref_number, '-', 4) as int)
  ), 0) + 1
  into v_sequence
  from (
    select ref_number from procurement_orders
      where facility_id = new.facility_id
        and to_char(month,'YYYY-MM') = v_year || '-' || v_month
    union all
    select ref_number from contract_payments
      where facility_id = new.facility_id
        and to_char(month,'YYYY-MM') = v_year || '-' || v_month
    union all
    select ref_number from revenue_entries
      where facility_id = new.facility_id
        and to_char(month,'YYYY-MM') = v_year || '-' || v_month
    union all
    select ref_number from deductions
      where facility_id = new.facility_id
        and to_char(month,'YYYY-MM') = v_year || '-' || v_month
  ) all_refs
  where ref_number is not null
    and ref_number like v_code || '-' || v_year || '-' || v_month || '-%';

  new.ref_number := v_code || '-' || v_year || '-' || v_month || '-' || lpad(v_sequence::text, 4, '0');
  return new;
end;
$$;

create trigger trg_ref_procurement
  before insert on procurement_orders
  for each row execute procedure public.generate_ref_number_expenses();

create trigger trg_ref_contract_payments
  before insert on contract_payments
  for each row execute procedure public.generate_ref_number_expenses();

-- ─────────────────────────────────────────────
-- 5. RLS — المصروفات والعقود
-- ─────────────────────────────────────────────
alter table procurement_orders  enable row level security;
alter table contracts           enable row level security;
alter table contract_payments   enable row level security;

-- Procurement Orders
create policy "facility roles manage procurement" on procurement_orders
  for all using (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin','hospital_data_entry']));
create policy "ministry reads all procurement" on procurement_orders
  for select using (user_has_role_for_facility(facility_id, array['super_admin','ministry_viewer']));
create policy "hospital_viewer reads own procurement" on procurement_orders
  for select using (user_has_role_for_facility(facility_id, array['hospital_viewer']));

-- Contracts
create policy "facility roles manage contracts" on contracts
  for all using (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin','hospital_data_entry']));
create policy "ministry reads all contracts" on contracts
  for select using (user_has_role_for_facility(facility_id, array['super_admin','ministry_viewer']));
create policy "hospital_viewer reads own contracts" on contracts
  for select using (user_has_role_for_facility(facility_id, array['hospital_viewer']));

-- Contract Payments
create policy "facility roles manage contract payments" on contract_payments
  for all using (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin','hospital_data_entry']));
create policy "ministry reads all contract payments" on contract_payments
  for select using (user_has_role_for_facility(facility_id, array['super_admin','ministry_viewer']));
create policy "hospital_viewer reads own contract payments" on contract_payments
  for select using (user_has_role_for_facility(facility_id, array['hospital_viewer']));
