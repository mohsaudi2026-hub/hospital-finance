-- ============================================================
-- Migration 007: إنشاء مستشفى تجريبي مخصص + حسابات تجريبية جاهزة بكبسة زر واحدة
-- ============================================================

-- 1. تفعيل ملحق التشفير pgcrypto إذا لم يكن مفعلاً
create extension if not exists pgcrypto;

-- 2. إضافة منشأة تجريبية مخصصة للاختبار والتجربة
insert into facilities (directorate_id, name, code, institutional_code, facility_type)
values (
  (select id from health_directorates where code='DIR-CAI' limit 1),
  'مستشفى النموذج التجريبي للاختبار',
  'DEMO01',
  '999001',
  'hospital'
) on conflict (code) do nothing;

-- 3. دالة مساعدة لإنشاء مستخدم وتعيين دوره
create or replace function public.create_demo_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role_name text,
  p_facility_code text default null,
  p_must_change_password boolean default false
)
returns void language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_role_id uuid;
  v_facility_id uuid;
begin
  -- البحث عن معرّف الدور
  select id into v_role_id from public.roles where name = p_role_name limit 1;
  
  -- البحث عن معرّف المنشأة إن وجدت
  if p_facility_code is not null then
    select id into v_facility_id from public.facilities where code = p_facility_code limit 1;
  end if;

  -- فحص هل المستخدم موجود مسبقاً في auth.users
  select id into v_user_id from auth.users where email = p_email limit 1;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    
    -- إنشاء المستخدم في auth.users
    insert into auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    )
    values (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  else
    -- تحديث كلمة المرور إن كان موجوداً
    update auth.users
    set encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = now()
    where id = v_user_id;
  end if;

  -- التأكد من وجود/تحديث الملف الشخصي
  insert into public.profiles (id, full_name, must_change_password)
  values (v_user_id, p_full_name, p_must_change_password)
  on conflict (id) do update
  set full_name = p_full_name,
      must_change_password = p_must_change_password;

  -- حذف أي صلاحيات قديمة لنفس المستخدم وإعادة التعيين
  delete from public.user_facility_roles where user_id = v_user_id;

  -- ربط الصلاحية والمنشأة
  if v_role_id is not null then
    insert into public.user_facility_roles (user_id, facility_id, role_id)
    values (v_user_id, v_facility_id, v_role_id)
    on conflict do nothing;
  end if;

end;
$$;

-- 4. إنشاء الحسابات التجريبية لكافة الأدوار:

-- الحساب 1: مدير عام المنظومة (Super Admin)
select public.create_demo_user(
  'super@admin.com',
  'Admin@123456',
  'مدير عام المنظومة',
  'super_admin',
  null,
  false
);

-- الحساب 2: متابع عام للوزارة (Ministry Executive Viewer - قراءة فقط للداشبورد والتقارير)
select public.create_demo_user(
  'viewer@health.gov.eg',
  'Viewer@123456',
  'د. مسؤول المتابعة بالوزارة',
  'ministry_viewer',
  null,
  false
);

-- الحساب 3: مدير المستشفى التجريبي (Hospital Admin - اعتماد وإدارة مستخدمين)
select public.create_demo_user(
  'admin@demo-hospital.com',
  'Hospital@123456',
  'د. مدير المستشفى التجريبي',
  'hospital_admin',
  'DEMO01',
  false
);

-- الحساب 4: مدخل بيانات المستشفى التجريبي (Hospital Data Entry - إدخال إيرادات ومصروفات)
select public.create_demo_user(
  'entry@demo-hospital.com',
  'Entry@123456',
  'أ. مسؤول الحسابات والإدخال',
  'hospital_data_entry',
  'DEMO01',
  false
);
