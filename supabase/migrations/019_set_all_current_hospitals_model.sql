-- ============================================================
-- Migration 019 — تسجيل كافة المستشفيات الحالية في مبادرة المستشفيات النموذجية
-- ============================================================

-- تحديث كافة المستشفيات والمراكز لتصبح ضمن مبادرة رئيس الجمهورية للمستشفيات النموذجية
update public.facilities
set is_model_hospital = true
where facility_type in ('hospital', 'specialized_center')
   or code like '%01' or code like '%02' or code like '%03' or code = 'DEMO01';

notify pgrst, 'reload schema';
