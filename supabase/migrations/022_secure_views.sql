-- ============================================================
-- Migration 022 — تأمين المشاهد الإحصائية وتفعيل الأمان (Security Invoker)
-- ============================================================

-- تفعيل تطبيق سياسات RLS الخاصة بالمستخدم المستعلم على الـ Views
alter view if exists public.annual_summary set (security_invoker = true);
alter view if exists public.quarterly_summary set (security_invoker = true);
alter view if exists public.monthly_facility_summary set (security_invoker = true);
alter view if exists public.ministry_overview set (security_invoker = true);
alter view if exists public.revenue_by_source set (security_invoker = true);

notify pgrst, 'reload schema';
