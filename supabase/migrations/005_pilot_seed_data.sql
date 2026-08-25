-- ============================================================
-- Migration 005 — Pilot Seed Data
-- 13 محافظة + 16 إدارة صحية + 24 مستشفى تجريبي
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. المحافظات الـ 13
-- ─────────────────────────────────────────────
insert into governorates (name, code, display_order) values
  ('القاهرة',       'CAI',  1),
  ('الجيزة',        'GIZ',  2),
  ('الإسكندرية',   'ALX',  3),
  ('الدقهلية',      'DAK',  4),
  ('دمياط',         'DIM',  5),
  ('الشرقية',       'SHA',  6),
  ('القليوبية',     'KAL',  7),
  ('الغربية',       'GHR',  8),
  ('كفر الشيخ',    'KFS',  9),
  ('سوهاج',        'SOH', 10),
  ('قنا',           'QNA', 11),
  ('أسيوط',        'ASY', 12),
  ('شمال سيناء',   'NSN', 13)
on conflict (code) do nothing;

-- ─────────────────────────────────────────────
-- 2. الإدارات الصحية (13 مديرية + 3 أمانة مراكز طبية)
-- ─────────────────────────────────────────────
insert into health_directorates (governorate_id, name, code) values
  -- مديريات الشئون الصحية
  ((select id from governorates where code='CAI'), 'مديرية الشئون الصحية - القاهرة',        'DIR-CAI'),
  ((select id from governorates where code='GIZ'), 'مديرية الشئون الصحية - الجيزة',          'DIR-GIZ'),
  ((select id from governorates where code='ALX'), 'مديرية الشئون الصحية - الإسكندرية',     'DIR-ALX'),
  ((select id from governorates where code='DAK'), 'مديرية الشئون الصحية - الدقهلية',        'DIR-DAK'),
  ((select id from governorates where code='DIM'), 'مديرية الشئون الصحية - دمياط',           'DIR-DIM'),
  ((select id from governorates where code='SHA'), 'مديرية الشئون الصحية - الشرقية',         'DIR-SHA'),
  ((select id from governorates where code='KAL'), 'مديرية الشئون الصحية - القليوبية',       'DIR-KAL'),
  ((select id from governorates where code='GHR'), 'مديرية الشئون الصحية - الغربية',         'DIR-GHR'),
  ((select id from governorates where code='KFS'), 'مديرية الشئون الصحية - كفر الشيخ',      'DIR-KFS'),
  ((select id from governorates where code='SOH'), 'مديرية الشئون الصحية - سوهاج',           'DIR-SOH'),
  ((select id from governorates where code='QNA'), 'مديرية الشئون الصحية - قنا',             'DIR-QNA'),
  ((select id from governorates where code='ASY'), 'مديرية الشئون الصحية - أسيوط',           'DIR-ASY'),
  ((select id from governorates where code='NSN'), 'مديرية الشئون الصحية - شمال سيناء',     'DIR-NSN'),
  -- أمانة المراكز الطبية (مرتبطة بمحافظتها الجغرافية)
  ((select id from governorates where code='NSN'), 'أمانة المراكز الطبية - شمال سيناء',     'AMT-NSN'),
  ((select id from governorates where code='CAI'), 'أمانة المراكز الطبية - القاهرة',         'AMT-CAI'),
  ((select id from governorates where code='GIZ'), 'أمانة المراكز الطبية - الجيزة',          'AMT-GIZ')
on conflict (code) do nothing;

-- ─────────────────────────────────────────────
-- 3. المستشفيات الـ 24 التجريبية
-- ─────────────────────────────────────────────
insert into facilities (directorate_id, name, code, facility_type) values
  -- أمانة مراكز طبية (3 مستشفيات)
  ((select id from health_directorates where code='AMT-NSN'), 'مستشفى بئر العبد التخصصي',         'NSN01', 'hospital'),
  ((select id from health_directorates where code='AMT-CAI'), 'مستشفى 15 مايو التخصصي',            'CAI01', 'hospital'),
  ((select id from health_directorates where code='AMT-GIZ'), 'مستشفى العجوزة',                    'GIZ01', 'hospital'),

  -- محافظة القاهرة — علاجي (2)
  ((select id from health_directorates where code='DIR-CAI'), 'مستشفى عين شمس العام',              'CAI02', 'hospital'),
  ((select id from health_directorates where code='DIR-CAI'), 'مستشفى منشية البكري',               'CAI03', 'hospital'),

  -- محافظة الدقهلية — علاجي (1)
  ((select id from health_directorates where code='DIR-DAK'), 'مستشفى أجا المركزي',                'DAK01', 'hospital'),

  -- محافظة الإسكندرية — علاجي (1)
  ((select id from health_directorates where code='DIR-ALX'), 'مستشفى رأس التين العام',            'ALX01', 'hospital'),

  -- محافظة دمياط — علاجي (1)
  ((select id from health_directorates where code='DIR-DIM'), 'مستشفى كفر سعد المركزي',            'DIM01', 'hospital'),

  -- محافظة الشرقية — علاجي (1)
  ((select id from health_directorates where code='DIR-SHA'), 'مستشفى السعديين المركزي',           'SHA01', 'hospital'),

  -- محافظة الجيزة — علاجي (2)
  ((select id from health_directorates where code='DIR-GIZ'), 'مستشفى شبرامنت المركزي',            'GIZ02', 'hospital'),
  ((select id from health_directorates where code='DIR-GIZ'), 'مستشفى بولاق الدكرور العام',        'GIZ03', 'hospital'),

  -- محافظة سوهاج — علاجي (3)
  ((select id from health_directorates where code='DIR-SOH'), 'مستشفى جهينة المركزي',              'SOH01', 'hospital'),
  ((select id from health_directorates where code='DIR-SOH'), 'مستشفى طهطا العام',                 'SOH02', 'hospital'),
  ((select id from health_directorates where code='DIR-SOH'), 'مستشفى ساقلتة المركزي',             'SOH03', 'hospital'),

  -- محافظة كفر الشيخ — علاجي (2)
  ((select id from health_directorates where code='DIR-KFS'), 'مستشفى بيلا المركزي',               'KFS01', 'hospital'),
  ((select id from health_directorates where code='DIR-KFS'), 'مستشفى سيدي غازي المركزي',          'KFS02', 'hospital'),

  -- محافظة القليوبية — علاجي (2)
  ((select id from health_directorates where code='DIR-KAL'), 'مستشفى القناطر الخيرية',            'KAL01', 'hospital'),
  ((select id from health_directorates where code='DIR-KAL'), 'مستشفى طوخ المركزي',                'KAL02', 'hospital'),

  -- محافظة الغربية — علاجي (2)
  ((select id from health_directorates where code='DIR-GHR'), 'مستشفى طنطا العام',                 'GHR01', 'hospital'),
  ((select id from health_directorates where code='DIR-GHR'), 'مستشفى زفتي العام',                 'GHR02', 'hospital'),

  -- محافظة قنا — علاجي (2)
  ((select id from health_directorates where code='DIR-QNA'), 'مستشفى أبو تشت المركزي',            'QNA01', 'hospital'),
  ((select id from health_directorates where code='DIR-QNA'), 'مستشفى نجع حمادي',                  'QNA02', 'hospital'),

  -- محافظة أسيوط — علاجي (2)
  ((select id from health_directorates where code='DIR-ASY'), 'مستشفى منفلوط المركزي',             'ASY01', 'hospital'),
  ((select id from health_directorates where code='DIR-ASY'), 'مستشفى ديروط المركزي',              'ASY02', 'hospital')
on conflict (code) do nothing;
