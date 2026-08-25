-- ============================================================
-- Migration 011: توليد وتجهيز حسابات مديري ومدخلي بيانات لكافة المستشفيات الـ 24
-- بكلمات مرور افتراضية موحدة وموثقة للتسليم الرسمي
-- ============================================================

create extension if not exists pgcrypto;

do $$
declare
  v_fac record;
  v_admin_email text;
  v_entry_email text;
  v_admin_pwd text := 'Hospital@123456';
  v_entry_pwd text := 'Entry@123456';
  v_admin_user_id uuid;
  v_entry_user_id uuid;
  v_admin_role_id uuid;
  v_entry_role_id uuid;
begin
  select id into v_admin_role_id from public.roles where name = 'hospital_admin' limit 1;
  select id into v_entry_role_id from public.roles where name = 'hospital_data_entry' limit 1;

  for v_fac in select id, code, name from public.facilities loop
    v_admin_email := 'admin.' || lower(v_fac.code) || '@health.gov.eg';
    v_entry_email := 'entry.' || lower(v_fac.code) || '@health.gov.eg';

    -- ─────────────────────────────────────────────
    -- 1. حساب مدير المستشفى (Hospital Admin)
    -- ─────────────────────────────────────────────
    select id into v_admin_user_id from auth.users where email = v_admin_email limit 1;
    if v_admin_user_id is null then
      v_admin_user_id := gen_random_uuid();
      insert into auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
      )
      values (
        v_admin_user_id, '00000000-0000-0000-0000-000000000000', v_admin_email,
        crypt(v_admin_pwd, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', 'مدير ' || v_fac.name),
        now(), now(), 'authenticated', 'authenticated'
      );
    else
      update auth.users
      set encrypted_password = crypt(v_admin_pwd, gen_salt('bf')), updated_at = now()
      where id = v_admin_user_id;
    end if;

    insert into public.profiles (id, full_name, must_change_password)
    values (v_admin_user_id, 'مدير ' || v_fac.name, false)
    on conflict (id) do update set full_name = 'مدير ' || v_fac.name;

    delete from public.user_facility_roles where user_id = v_admin_user_id;
    insert into public.user_facility_roles (user_id, facility_id, role_id)
    values (v_admin_user_id, v_fac.id, v_admin_role_id)
    on conflict do nothing;

    -- ─────────────────────────────────────────────
    -- 2. حساب مسؤول إدخال البيانات (Hospital Data Entry)
    -- ─────────────────────────────────────────────
    select id into v_entry_user_id from auth.users where email = v_entry_email limit 1;
    if v_entry_user_id is null then
      v_entry_user_id := gen_random_uuid();
      insert into auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
      )
      values (
        v_entry_user_id, '00000000-0000-0000-0000-000000000000', v_entry_email,
        crypt(v_entry_pwd, gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', 'مسؤول حسابات ' || v_fac.name),
        now(), now(), 'authenticated', 'authenticated'
      );
    else
      update auth.users
      set encrypted_password = crypt(v_entry_pwd, gen_salt('bf')), updated_at = now()
      where id = v_entry_user_id;
    end if;

    insert into public.profiles (id, full_name, must_change_password)
    values (v_entry_user_id, 'مسؤول حسابات ' || v_fac.name, false)
    on conflict (id) do update set full_name = 'مسؤول حسابات ' || v_fac.name;

    delete from public.user_facility_roles where user_id = v_entry_user_id;
    insert into public.user_facility_roles (user_id, facility_id, role_id)
    values (v_entry_user_id, v_fac.id, v_entry_role_id)
    on conflict do nothing;

  end loop;
end;
$$;
