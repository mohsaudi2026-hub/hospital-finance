-- ============================================================
-- Migration 018 — الهيكل الإداري الوطني الشامل لوزارة الصحة ومبادرة المستشفيات النموذجية
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. إدراج محافظات جمهورية مصر العربية الـ 27 بالكامل
-- ─────────────────────────────────────────────
insert into public.governorates (name, code, display_order, is_active) values
  ('القاهرة',          'CAI',  1, true),
  ('الجيزة',           'GIZ',  2, true),
  ('الإسكندرية',      'ALX',  3, true),
  ('القليوبية',        'KAL',  4, true),
  ('الدقهلية',         'DAK',  5, true),
  ('الشرقية',          'SHA',  6, true),
  ('المنوفية',         'MNF',  7, true),
  ('الغربية',          'GHR',  8, true),
  ('كفر الشيخ',       'KFS',  9, true),
  ('دمياط',            'DIM', 10, true),
  ('البحيرة',          'BEH', 11, true),
  ('الإسماعيلية',     'ISM', 12, true),
  ('بورسعيد',          'POR', 13, true),
  ('السويس',           'SUZ', 14, true),
  ('شمال سيناء',      'NSN', 15, true),
  ('جنوب سيناء',      'SSN', 16, true),
  ('البحر الأحمر',     'RED', 17, true),
  ('الفيوم',           'FYM', 18, true),
  ('بني سويف',         'BNS', 19, true),
  ('المنيا',           'MIN', 20, true),
  ('أسيوط',           'ASY', 21, true),
  ('سوهاج',           'SOH', 22, true),
  ('قنا',              'QNA', 23, true),
  ('الأقصر',           'LXR', 24, true),
  ('أسوان',            'ASW', 25, true),
  ('مطروح',            'MAT', 26, true),
  ('الوادي الجديد',    'WAD', 27, true)
on conflict (code) do update
set name = excluded.name, display_order = excluded.display_order;

-- ─────────────────────────────────────────────
-- 2. إدراج مديريات الشئون الصحية الـ 27 + أمانة المراكز المتخصصة + هيئة المعاهد التعليمية
-- ─────────────────────────────────────────────
insert into public.health_directorates (governorate_id, name, code, is_active) values
  -- مديريات الشئون الصحية الـ 27
  ((select id from governorates where code='CAI'), 'مديرية الشئون الصحية بالقاهرة',          'DIR-CAI', true),
  ((select id from governorates where code='GIZ'), 'مديرية الشئون الصحية بالجيزة',           'DIR-GIZ', true),
  ((select id from governorates where code='ALX'), 'مديرية الشئون الصحية بالإسكندرية',      'DIR-ALX', true),
  ((select id from governorates where code='KAL'), 'مديرية الشئون الصحية بالقليوبية',        'DIR-KAL', true),
  ((select id from governorates where code='DAK'), 'مديرية الشئون الصحية بالدقهلية',         'DIR-DAK', true),
  ((select id from governorates where code='SHA'), 'مديرية الشئون الصحية بالشرقية',          'DIR-SHA', true),
  ((select id from governorates where code='MNF'), 'مديرية الشئون الصحية بالمنوفية',         'DIR-MNF', true),
  ((select id from governorates where code='GHR'), 'مديرية الشئون الصحية بالغربية',          'DIR-GHR', true),
  ((select id from governorates where code='KFS'), 'مديرية الشئون الصحية بكفر الشيخ',       'DIR-KFS', true),
  ((select id from governorates where code='DIM'), 'مديرية الشئون الصحية بدمياط',            'DIR-DIM', true),
  ((select id from governorates where code='BEH'), 'مديرية الشئون الصحية بالبحيرة',          'DIR-BEH', true),
  ((select id from governorates where code='ISM'), 'مديرية الشئون الصحية بالإسماعيلية',      'DIR-ISM', true),
  ((select id from governorates where code='POR'), 'مديرية الشئون الصحية ببورسعيد',          'DIR-POR', true),
  ((select id from governorates where code='SUZ'), 'مديرية الشئون الصحية بالسويس',           'DIR-SUZ', true),
  ((select id from governorates where code='NSN'), 'مديرية الشئون الصحية بشمال سيناء',      'DIR-NSN', true),
  ((select id from governorates where code='SSN'), 'مديرية الشئون الصحية بجنوب سيناء',      'DIR-SSN', true),
  ((select id from governorates where code='RED'), 'مديرية الشئون الصحية بالبحر الأحمر',     'DIR-RED', true),
  ((select id from governorates where code='FYM'), 'مديرية الشئون الصحية بالفيوم',           'DIR-FYM', true),
  ((select id from governorates where code='BNS'), 'مديرية الشئون الصحية ببني سويف',         'DIR-BNS', true),
  ((select id from governorates where code='MIN'), 'مديرية الشئون الصحية بالمنيا',           'DIR-MIN', true),
  ((select id from governorates where code='ASY'), 'مديرية الشئون الصحية بأسيوط',           'DIR-ASY', true),
  ((select id from governorates where code='SOH'), 'مديرية الشئون الصحية بسوهاج',           'DIR-SOH', true),
  ((select id from governorates where code='QNA'), 'مديرية الشئون الصحية بقنا',              'DIR-QNA', true),
  ((select id from governorates where code='LXR'), 'مديرية الشئون الصحية بالأقصر',           'DIR-LXR', true),
  ((select id from governorates where code='ASW'), 'مديرية الشئون الصحية بأسوان',            'DIR-ASW', true),
  ((select id from governorates where code='MAT'), 'مديرية الشئون الصحية بمطروح',            'DIR-MAT', true),
  ((select id from governorates where code='WAD'), 'مديرية الشئون الصحية بالوادي الجديد',    'DIR-WAD', true),

  -- أمانة المراكز الطبية المتخصصة (مستوى موازي للمديريات)
  ((select id from governorates where code='CAI'), 'أمانة المراكز الطبية المتخصصة',         'AMT-NAT', true),
  -- الهيئة العامة للمستشفيات والمعاهد التعليمية
  ((select id from governorates where code='CAI'), 'الهيئة العامة للمستشفيات والمعاهد التعليمية', 'GOTHI', true)
on conflict (code) do update
set name = excluded.name;

-- ─────────────────────────────────────────────
-- 3. جدول الإدارات الصحية (المستوى الثالث تحت المديريات)
-- ─────────────────────────────────────────────
create table if not exists public.health_administrations (
  id             uuid primary key default gen_random_uuid(),
  directorate_id uuid not null references public.health_directorates(id) on delete cascade,
  name           text not null,
  code           text not null unique,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.health_administrations enable row level security;
drop policy if exists "authenticated reads health_administrations" on public.health_administrations;
create policy "authenticated reads health_administrations" on public.health_administrations
  for select using (auth.role() = 'authenticated');
drop policy if exists "super_admin manages health_administrations" on public.health_administrations;
create policy "super_admin manages health_administrations" on public.health_administrations
  for all using (is_super_admin());

-- إدراج نماذج من الإدارات الصحية
insert into public.health_administrations (directorate_id, name, code) values
  -- القاهرة
  ((select id from health_directorates where code='DIR-CAI'), 'الإدارة الصحية بوسط القاهرة',    'ADM-CAI-01'),
  ((select id from health_directorates where code='DIR-CAI'), 'الإدارة الصحية بشرق مدينة نصر',  'ADM-CAI-02'),
  ((select id from health_directorates where code='DIR-CAI'), 'الإدارة الصحية بالمعادي وطرة',  'ADM-CAI-03'),
  ((select id from health_directorates where code='DIR-CAI'), 'الإدارة الصحية بحلوان',         'ADM-CAI-04'),
  -- الجيزة
  ((select id from health_directorates where code='DIR-GIZ'), 'الإدارة الصحية بشمال الجيزة',    'ADM-GIZ-01'),
  ((select id from health_directorates where code='DIR-GIZ'), 'الإدارة الصحية بجنوب الجيزة',    'ADM-GIZ-02'),
  ((select id from health_directorates where code='DIR-GIZ'), 'الإدارة الصحية بـ 6 أكتوبر',     'ADM-GIZ-03'),
  -- الإسكندرية
  ((select id from health_directorates where code='DIR-ALX'), 'الإدارة الصحية بشرق الإسكندرية', 'ADM-ALX-01'),
  ((select id from health_directorates where code='DIR-ALX'), 'الإدارة الصحية بوسط الإسكندرية', 'ADM-ALX-02'),
  -- الدقهلية
  ((select id from health_directorates where code='DIR-DAK'), 'الإدارة الصحية بالمنصورة',       'ADM-DAK-01'),
  ((select id from health_directorates where code='DIR-DAK'), 'الإدارة الصحية بميت غمر',        'ADM-DAK-02')
on conflict (code) do nothing;

-- ─────────────────────────────────────────────
-- 4. تحديث جدول المنشآت (Facilities)
-- ─────────────────────────────────────────────
alter table public.facilities 
  add column if not exists administration_id uuid references public.health_administrations(id) on delete set null,
  add column if not exists is_model_hospital boolean not null default false,
  add column if not exists affiliation text not null default 'directorate';

-- تحديث فحص facility_type إن لزم
alter table public.facilities drop constraint if exists facilities_facility_type_check;
alter table public.facilities add constraint facilities_facility_type_check 
  check (facility_type in ('hospital','health_unit','family_health_center','specialized_center','health_administration','health_directorate'));

-- تحديث المستشفيات النموذجية ومستشفيات الأمانة
update public.facilities
set is_model_hospital = true
where code in ('CAI01', 'CAI02', 'GIZ01', 'ALX01', 'NSN01', 'DEMO01');

update public.facilities
set affiliation = 'specialized_centers_secretariat'
where directorate_id in (select id from health_directorates where code like 'AMT-%');

-- ─────────────────────────────────────────────
-- 5. إدراج وحدات صحية ومراكز طب أسرة ومستشفيات تخصصية
-- ─────────────────────────────────────────────
insert into public.facilities (
  directorate_id,
  administration_id,
  name,
  code,
  institutional_code,
  facility_type,
  is_model_hospital,
  affiliation
) values
  -- وحدات ومراكز طب أسرة بالقاهرة
  ((select id from health_directorates where code='DIR-CAI'),
   (select id from health_administrations where code='ADM-CAI-01'),
   'مركز طب أسرة السيدة زينب', 'U-CAI01', '881001', 'family_health_center', false, 'directorate'),

  ((select id from health_directorates where code='DIR-CAI'),
   (select id from health_administrations where code='ADM-CAI-02'),
   'مركز صحة الحي السابع بمدينة نصر', 'U-CAI02', '881002', 'family_health_center', false, 'directorate'),

  -- وحدات صحية بالجيزة
  ((select id from health_directorates where code='DIR-GIZ'),
   (select id from health_administrations where code='ADM-GIZ-01'),
   'وحدة صحة ميت عقبة', 'U-GIZ01', '882001', 'health_unit', false, 'directorate'),

  -- مستشفى نموذجي إضافي
  ((select id from health_directorates where code='DIR-ALX'),
   (select id from health_administrations where code='ADM-ALX-01'),
   'مستشفى شرق المدينة بالإسكندرية (نموذجي)', 'ALX02', '103002', 'hospital', true, 'directorate'),

  -- مركز أمانة المراكز المتخصصة
  ((select id from health_directorates where code='AMT-NAT'),
   null,
   'معهد ناصر للبحوث والعلاج', 'AMT-NASSER', '101099', 'specialized_center', true, 'specialized_centers_secretariat'),

  ((select id from health_directorates where code='AMT-NAT'),
   null,
   'مركز أورام السلام التخصصي', 'AMT-SALAM', '101098', 'specialized_center', false, 'specialized_centers_secretariat')
on conflict (code) do update
set is_model_hospital = excluded.is_model_hospital,
    affiliation = excluded.affiliation;

-- ─────────────────────────────────────────────
-- 6. تحديث Views التقارير المالية لدمج الحقول الجديدة
-- ─────────────────────────────────────────────
create or replace view public.monthly_facility_summary as
select
  f.id as facility_id,
  f.name as facility_name,
  f.code as facility_code,
  f.institutional_code,
  f.facility_type,
  f.is_model_hospital,
  f.affiliation,
  adm.name as administration_name,
  d.name as directorate_name,
  d.code as directorate_code,
  g.name as governorate_name,
  g.code as governorate_code,
  coalesce(re.month, ded.month, po.month, cp.month) as month,
  extract(year from coalesce(re.month, ded.month, po.month, cp.month))::int as fiscal_year,
  coalesce(re.total_revenue, 0) as total_revenue,
  coalesce(ded.total_deductions, 0) as total_deductions,
  coalesce(re.total_revenue, 0) - coalesce(ded.total_deductions, 0) as net_revenue,
  coalesce(po.total_procurement, 0) as total_procurement,
  coalesce(cp.total_contract_payments, 0) as total_contract_payments,
  coalesce(po.total_procurement, 0) + coalesce(cp.total_contract_payments, 0) as total_expenses,
  case when mc.id is not null then true else false end as is_closed
from public.facilities f
join public.health_directorates d on d.id = f.directorate_id
join public.governorates g on g.id = d.governorate_id
left join public.health_administrations adm on adm.id = f.administration_id
left join (
  select facility_id, month, sum(amount) as total_revenue
  from public.revenue_entries
  group by facility_id, month
) re on re.facility_id = f.id
left join (
  select facility_id, month, sum(amount) as total_deductions
  from public.deductions
  group by facility_id, month
) ded on ded.facility_id = f.id and ded.month = re.month
left join (
  select facility_id, month, sum(total_amount) as total_procurement
  from public.procurement_orders
  group by facility_id, month
) po on po.facility_id = f.id and po.month = re.month
left join (
  select c.facility_id, to_char(cp.payment_date, 'YYYY-MM-01')::date as month, sum(cp.amount) as total_contract_payments
  from public.contract_payments cp
  join public.contracts c on c.id = cp.contract_id
  group by c.facility_id, to_char(cp.payment_date, 'YYYY-MM-01')::date
) cp on cp.facility_id = f.id and cp.month = re.month
left join public.monthly_closures mc on mc.facility_id = f.id and mc.month = re.month
where f.is_active = true and coalesce(re.month, ded.month, po.month, cp.month) is not null;

notify pgrst, 'reload schema';
