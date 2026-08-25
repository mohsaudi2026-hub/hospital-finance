-- ============================================================
-- Migration 001 — Phase 1: Auth + RBAC + Hierarchy + RLS
-- منصة البيانات المالية للمستشفيات — وزارة الصحة والسكان
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. ROLES
-- ─────────────────────────────────────────────
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null check (name in (
    'super_admin','ministry_viewer','hospital_admin','hospital_data_entry','hospital_viewer'
  )),
  description text
);

insert into roles (name, description) values
  ('super_admin',          'صلاحية كاملة على كل المنصة'),
  ('ministry_viewer',      'قراءة فقط لكل المنشآت — للداشبورد التنفيذي'),
  ('hospital_admin',       'إدارة مستخدمي منشأته واعتماد البيانات المدخلة'),
  ('hospital_data_entry',  'إدخال بيانات منشأته فقط، بدون اعتماد نهائي'),
  ('hospital_viewer',      'قراءة فقط لتقارير منشأته')
on conflict (name) do nothing;

-- ─────────────────────────────────────────────
-- 2. GEOGRAPHIC HIERARCHY
-- ─────────────────────────────────────────────

-- Level 1: Governorates (المحافظات)
create table if not exists governorates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null unique,
  code         text not null unique,   -- e.g. CAI, GIZ
  display_order int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Level 2: Health Directorates (الإدارات الصحية التنظيمية)
create table if not exists health_directorates (
  id              uuid primary key default gen_random_uuid(),
  governorate_id  uuid not null references governorates(id),
  name            text not null,
  code            text not null unique,  -- e.g. DIR-CAI, AMT-CAI
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Level 3: Facilities (المنشآت: مستشفى / وحدة صحية / إدارة صحية كمنشأة مالية)
create table if not exists facilities (
  id                 uuid primary key default gen_random_uuid(),
  directorate_id     uuid not null references health_directorates(id),
  name               text not null,
  code               text not null unique,   -- كود النظام الداخلي (CAI01) — للسوبر أدمن فقط
  institutional_code text,                   -- الكود المؤسسي الرسمي — يُدخله السوبر أدمن أو hospital_admin
  facility_type      text not null check (facility_type in ('hospital','health_unit','health_directorate')),
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 3. PROFILES (مرتبط بـ auth.users)
-- ─────────────────────────────────────────────
create table if not exists profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  phone                text,
  is_active            boolean not null default true,
  must_change_password boolean not null default true,
  created_at           timestamptz not null default now()
);

-- Trigger: ينشئ Profile تلقائياً عند إنشاء مستخدم جديد
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────────
-- 4. USER ↔ FACILITY ↔ ROLE
-- ─────────────────────────────────────────────
create table if not exists user_facility_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  facility_id uuid references facilities(id) on delete cascade,  -- null = وزارة (ministry_viewer / super_admin)
  role_id     uuid not null references roles(id),
  created_at  timestamptz not null default now(),
  unique (user_id, facility_id, role_id)
);

-- ─────────────────────────────────────────────
-- 5. AUDIT LOG (غير قابل للتعديل أو الحذف من أي صلاحية)
-- ─────────────────────────────────────────────
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references profiles(id),
  facility_id uuid references facilities(id),
  action      text not null check (action in ('create','update','approve','delete')),
  table_name  text not null,
  record_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 6. DISTRIBUTION PERCENTAGES — المادة (14)
-- ─────────────────────────────────────────────
create table if not exists distribution_percentages (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  percentage    numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  display_order int not null default 0,
  updated_at    timestamptz not null default now()
);

insert into distribution_percentages (label, percentage, display_order) values
  ('(أ) المزايا المالية الإضافية للعاملين',                       50.00, 1),
  ('(ب) المساهمة في نفقات التشغيل المختلفة',                      37.00, 2),
  ('(ج) دعم صندوق تحسين الخدمة بمديرية الشئون الصحية',            7.00, 3),
  ('(د) دعم صندوق تحسين الخدمة بديوان عام وزارة الصحة',           2.00, 4),
  ('(هـ) الدراسات العليا لأعضاء المهن الطبية',                    2.00, 5),
  ('(و) مشروعات وبرامج القطاع الصحي',                             2.00, 6)
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 7. STAFF DISTRIBUTION PERCENTAGES — المادة (15)
-- ─────────────────────────────────────────────
create table if not exists staff_distribution_percentages (
  id            uuid primary key default gen_random_uuid(),
  label         text not null,
  percentage    numeric(5,2) not null check (percentage >= 0 and percentage <= 100),
  display_order int not null default 0,
  updated_at    timestamptz not null default now()
);

insert into staff_distribution_percentages (label, percentage, display_order) values
  ('(أ) مدير المستشفى / مركز الخدمة العلاجية',                                              2.00, 1),
  ('(ب) نواب المدير / الوكلاء مجتمعين',                                                     1.00, 2),
  ('(ج) مدير الاستقبال والطوارئ ومدير العيادات ورؤساء الأقسام',                             2.00, 3),
  ('(د) الأطباء وأطباء الأسنان والصيادلة وممارسو العلاج الطبيعي',                          42.00, 4),
  ('(هـ) هيئة التمريض',                                                                     34.00, 5),
  ('(و) الإداريون وباقي فئات العاملين',                                                     15.00, 6),
  ('(ز) العاملون بالأقسام الوقائية (مكافحة العدوى / الترصد / الصحة المهنية)',               2.00, 7),
  ('(ح) مكافآت جهود غير عادية للمتميزين',                                                   2.00, 8)
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 8. ANNOUNCEMENTS (قراءة عامة قبل تسجيل الدخول)
-- ─────────────────────────────────────────────
create table if not exists announcements (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  body          text not null,
  is_active     boolean not null default true,
  display_order int not null default 0,
  created_by    uuid not null references profiles(id),
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 9. MONTHLY CLOSURES (قفل الشهر بعد الاعتماد)
-- ─────────────────────────────────────────────
create table if not exists monthly_closures (
  id          uuid primary key default gen_random_uuid(),
  facility_id uuid not null references facilities(id),
  month       date not null,
  closed_by   uuid not null references profiles(id),
  closed_at   timestamptz not null default now(),
  unique (facility_id, month)
);

-- Trigger: منع الكتابة على شهر مقفل
create or replace function public.prevent_write_to_closed_month()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from monthly_closures mc
    where mc.facility_id = new.facility_id
      and mc.month = new.month
  ) then
    raise exception 'هذا الشهر مقفل بعد الاعتماد النهائي — أي تصحيح يتطلب سجل تسوية منفصل';
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 10. RLS — تفعيل على كل الجداول
-- ─────────────────────────────────────────────
alter table governorates              enable row level security;
alter table health_directorates       enable row level security;
alter table facilities                enable row level security;
alter table profiles                  enable row level security;
alter table user_facility_roles       enable row level security;
alter table audit_log                 enable row level security;
alter table distribution_percentages  enable row level security;
alter table staff_distribution_percentages enable row level security;
alter table announcements             enable row level security;
alter table monthly_closures          enable row level security;

-- ─────────────────────────────────────────────
-- 11. دالة RLS المحورية (تُستخدم في كل السياسات)
-- ─────────────────────────────────────────────
create or replace function public.user_has_role_for_facility(
  target_facility_id uuid,
  allowed_roles text[]
)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_facility_roles ufr
    join roles r on r.id = ufr.role_id
    where ufr.user_id = auth.uid()
      and (ufr.facility_id = target_facility_id or ufr.facility_id is null)
      and r.name = any(allowed_roles)
  );
$$;

-- دالة مساعدة: هل المستخدم super_admin؟
create or replace function public.is_super_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_facility_roles ufr
    join roles r on r.id = ufr.role_id
    where ufr.user_id = auth.uid()
      and r.name = 'super_admin'
  );
$$;

-- ─────────────────────────────────────────────
-- 12. سياسات RLS
-- ─────────────────────────────────────────────

-- GOVERNORATES
create policy "super_admin manages governorates" on governorates
  for all using (is_super_admin());
create policy "authenticated reads governorates" on governorates
  for select using (auth.role() = 'authenticated');

-- HEALTH DIRECTORATES
create policy "super_admin manages directorates" on health_directorates
  for all using (is_super_admin());
create policy "authenticated reads directorates" on health_directorates
  for select using (auth.role() = 'authenticated');

-- FACILITIES
create policy "super_admin manages facilities" on facilities
  for all using (is_super_admin());
create policy "ministry reads all facilities" on facilities
  for select using (user_has_role_for_facility(id, array['super_admin','ministry_viewer']));
create policy "facility roles read own facility" on facilities
  for select using (user_has_role_for_facility(id, array['hospital_admin','hospital_data_entry','hospital_viewer']));
create policy "hospital_admin updates own institutional_code" on facilities
  for update using (user_has_role_for_facility(id, array['hospital_admin']));

-- PROFILES
create policy "users read own profile" on profiles
  for select using (id = auth.uid());
create policy "users update own profile" on profiles
  for update using (id = auth.uid());
create policy "admins manage profiles in scope" on profiles
  for all using (
    exists (
      select 1 from user_facility_roles ufr
      join roles r on r.id = ufr.role_id
      where ufr.user_id = auth.uid()
        and r.name in ('super_admin','hospital_admin')
    )
  );

-- USER_FACILITY_ROLES
create policy "super_admin manages all role assignments" on user_facility_roles
  for all using (is_super_admin());
create policy "hospital_admin manages own facility roles" on user_facility_roles
  for all using (user_has_role_for_facility(facility_id, array['hospital_admin']));
create policy "users read own role" on user_facility_roles
  for select using (user_id = auth.uid());

-- AUDIT LOG: قراءة فقط، لا حذف لأي دور
create policy "ministry reads audit log" on audit_log
  for select using (user_has_role_for_facility(facility_id, array['super_admin','ministry_viewer']));
-- ملاحظة: لا توجد سياسة insert/update/delete من الواجهة — فقط من triggers/functions

-- DISTRIBUTION PERCENTAGES
create policy "everyone reads distribution" on distribution_percentages
  for select using (auth.role() = 'authenticated');
create policy "super_admin edits distribution" on distribution_percentages
  for all using (is_super_admin()) with check (is_super_admin());

-- STAFF DISTRIBUTION PERCENTAGES
create policy "everyone reads staff distribution" on staff_distribution_percentages
  for select using (auth.role() = 'authenticated');
create policy "super_admin edits staff distribution" on staff_distribution_percentages
  for all using (is_super_admin()) with check (is_super_admin());

-- ANNOUNCEMENTS (قراءة عامة بدون تسجيل دخول — للوحة تسجيل الدخول)
create policy "public reads active announcements" on announcements
  for select using (is_active = true);
create policy "super_admin manages announcements" on announcements
  for all using (is_super_admin()) with check (is_super_admin());

-- MONTHLY CLOSURES
create policy "admin closes month" on monthly_closures
  for insert with check (user_has_role_for_facility(facility_id, array['super_admin','hospital_admin']));
create policy "all read closures in scope" on monthly_closures
  for select using (
    user_has_role_for_facility(facility_id, array[
      'super_admin','ministry_viewer','hospital_admin','hospital_data_entry','hospital_viewer'
    ])
  );
