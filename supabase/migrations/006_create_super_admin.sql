-- ============================================================
-- SQL Helper: إنشاء حساب مدير النظام (super@admin.com) وتعيين الصلاحية
-- ============================================================

-- طريقة 1: إذا قمت بإنشاء المستخدم من لوحة Supabase Auth
-- قم بتشغيل هذا الاستعلام بعد إنشاء المستخدم بالبريد super@admin.com لربطه بصلاحية super_admin:

do $$
declare
  v_user_id uuid;
  v_role_id uuid;
begin
  -- البحث عن معرّف المستخدم super@admin.com
  select id into v_user_id from auth.users where email = 'super@admin.com' limit 1;
  
  -- البحث عن معرّف دور super_admin
  select id into v_role_id from public.roles where name = 'super_admin' limit 1;
  
  if v_user_id is not null and v_role_id is not null then
    -- تعيين صلاحية مدير النظام العام (بدون منشأة محددة = على مستوى الوزارة والمنظومة كاملة)
    insert into public.user_facility_roles (user_id, facility_id, role_id)
    values (v_user_id, null, v_role_id)
    on conflict do nothing;

    -- التأكد من وجود ملف Profile وتفعيل must_change_password
    update public.profiles
    set full_name = 'مدير عام المنظومة',
        must_change_password = true
    where id = v_user_id;

    raise notice 'تم تعيين حساب super@admin.com كمدير للنظام بنجاح!';
  else
    raise notice 'يرجى إنشاء مستخدم بالبريد super@admin.com من لوحة التحكم Authentication أولاً.';
  end if;
end;
$$;
