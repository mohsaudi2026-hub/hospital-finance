-- ============================================================
-- Migration 010: إضافة الرقم القومي وبيانات الامتثال الأمني لجدول profiles
-- ============================================================

alter table public.profiles
add column if not exists national_id varchar(14);

comment on column public.profiles.national_id is 'الرقم القومي للموظف (14 رقماً) للامتثال الأمني والحوكمة';
