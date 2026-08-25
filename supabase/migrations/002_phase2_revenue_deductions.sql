-- ============================================================
-- Migration 002 — Phase 2: الإيرادات (8 مصادر) + التجنيب
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. REVENUE SOURCES — 8 مصادر رسمية من اللائحة
-- ─────────────────────────────────────────────
create table if not exists revenue_sources (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  display_order int not null default 0,
  is_active     boolean not null default true
);

insert into revenue_sources (label, display_order) values
  ('خدمات العلاج بأجر',                                                          1),
  ('مقابل خدمات استخراج الشهادات الطبية والتقارير الطبية وخلافه',                2),
  ('مقابل زيارة المرضى',                                                         3),
  ('التبرعات النقدية والعينية والهبات',                                          4),
  ('حصيلة خدمات العلاج على نفقة الدولة',                                        5),
  ('حصيلة خدمات العلاج بالتأمين الصحي',                                         6),
  ('حصيلة خدمات العلاج شركات خاصة (المظلات التأمينية المماثلة)',                 7),
  ('موارد أخرى',                                                                 8)
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 2. REVENUE ENTRIES
-- ─────────────────────────────────────────────
create table if not exists revenue_entries (
  id                uuid primary key default gen_random_uuid(),
  ref_number        text unique,                       -- يُولَّد تلقائياً بـ trigger
  facility_id       uuid not null references facilities(id),
  revenue_source_id uuid not null references revenue_sources(id),
  month             date not null,                     -- دائماً أول يوم في الشهر (YYYY-MM-01)
  amount            numeric(14,2) not null check (amount >= 0),
  notes             text check (char_length(notes) <= 500),
  created_by        uuid not null references profiles(id),
  created_at        timestamptz not null default now(),
  unique (facility_id, revenue_source_id, month)
);

-- Trigger: قفل الشهر
create trigger trg_lock_revenue_entries
  before insert or update on revenue_entries
  for each row execute procedure public.prevent_write_to_closed_month();

-- ─────────────────────────────────────────────
-- 3. DEDUCTIONS — التجنيب (نوعان فقط)
-- ─────────────────────────────────────────────
create table if not exists deductions (
  id             uuid primary key default gen_random_uuid(),
  ref_number     text unique,
  facility_id    uuid not null references facilities(id),
  month          date not null,
  deduction_type text not null check (deduction_type in ('staff_dues','medicine_supplies')),
  amount         numeric(14,2) not null check (amount >= 0),
  notes          text check (char_length(notes) <= 500),
  created_by     uuid not null references profiles(id),
  created_at     timestamptz not null default now(),
  unique (facility_id, month, deduction_type)
);

-- Trigger: قفل الشهر
create trigger trg_lock_deductions
  before insert or update on deductions
  for each row execute procedure public.prevent_write_to_closed_month();

-- ─────────────────────────────────────────────
-- 4. Trigger: توليد الرقم المرجعي الفريد
-- الصيغة: <كود المنشأة>-<السنة>-<الشهر>-<تسلسل>
-- مثال: CAI02-2026-08-0001
-- ─────────────────────────────────────────────
create or replace function public.generate_ref_number()
returns trigger language plpgsql as $$
declare
  v_code     text;
  v_year     text;
  v_month    text;
  v_sequence int;
  v_ref      text;
begin
  select code into v_code from facilities where id = new.facility_id;
  v_year  := to_char(new.month, 'YYYY');
  v_month := to_char(new.month, 'MM');

  -- تسلسل داخل نفس المنشأة والشهر لنفس الجدول
  select coalesce(max(
    cast(split_part(ref_number, '-', 4) as int)
  ), 0) + 1
  into v_sequence
  from (
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

create trigger trg_ref_revenue_entries
  before insert on revenue_entries
  for each row execute procedure public.generate_ref_number();

create trigger trg_ref_deductions
  before insert on deductions
  for each row execute procedure public.generate_ref_number();

-- ─────────────────────────────────────────────
-- 5. RLS — الإيرادات والتجنيب
-- ─────────────────────────────────────────────
alter table revenue_sources  enable row level security;
alter table revenue_entries  enable row level security;
alter table deductions       enable row level security;

-- Revenue Sources: قراءة للجميع، تعديل للسوبر أدمن فقط
create policy "authenticated reads revenue sources" on revenue_sources
  for select using (auth.role() = 'authenticated');
create policy "super_admin edits revenue sources" on revenue_sources
  for all using (is_super_admin()) with check (is_super_admin());

-- Revenue Entries
create policy "facility roles manage revenue entries" on revenue_entries
  for all using (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin','hospital_data_entry']));
create policy "ministry reads all revenue entries" on revenue_entries
  for select using (user_has_role_for_facility(facility_id, array['super_admin','ministry_viewer']));
create policy "hospital_viewer reads own revenue entries" on revenue_entries
  for select using (user_has_role_for_facility(facility_id, array['hospital_viewer']));

-- Deductions
create policy "facility roles manage deductions" on deductions
  for all using (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin','hospital_data_entry']));
create policy "ministry reads all deductions" on deductions
  for select using (user_has_role_for_facility(facility_id, array['super_admin','ministry_viewer']));
create policy "hospital_viewer reads own deductions" on deductions
  for select using (user_has_role_for_facility(facility_id, array['hospital_viewer']));
