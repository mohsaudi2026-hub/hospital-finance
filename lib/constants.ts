// ─────────────────────────────────────────────
// lib/constants.ts
// كل القيم الثابتة في النظام — لا تكرار في أي ملف آخر
// ─────────────────────────────────────────────

// أدوار المستخدمين
export const ROLES = {
  SUPER_ADMIN:         'super_admin',
  MINISTRY_VIEWER:     'ministry_viewer',
  HOSPITAL_ADMIN:      'hospital_admin',
  HOSPITAL_DATA_ENTRY: 'hospital_data_entry',
  HOSPITAL_VIEWER:     'hospital_viewer',
} as const;

export type RoleName = typeof ROLES[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleName, string> = {
  super_admin:          'مدير النظام',
  ministry_viewer:      'مشاهد وزارة',
  hospital_admin:       'مدير منشأة',
  hospital_data_entry:  'مدخل بيانات',
  hospital_viewer:      'مشاهد منشأة',
};

// أنواع المنشآت
export const FACILITY_TYPES = {
  HOSPITAL:              'hospital',
  HEALTH_UNIT:           'health_unit',
  FAMILY_HEALTH_CENTER:  'family_health_center',
  SPECIALIZED_CENTER:    'specialized_center',
  HEALTH_ADMINISTRATION: 'health_administration',
  HEALTH_DIRECTORATE:    'health_directorate',
} as const;

export type FacilityType = typeof FACILITY_TYPES[keyof typeof FACILITY_TYPES];

export const FACILITY_TYPE_LABELS: Record<FacilityType, string> = {
  hospital:              'مستشفى عام / مركزي / نوعي',
  health_unit:           'وحدة صحية',
  family_health_center:  'مركز طب أسرة',
  specialized_center:    'مركز / مستشفى تخصصي',
  health_administration: 'إدارة صحية',
  health_directorate:    'مديرية الشئون الصحية',
};

// جهات التبعية الإدارية
export const AFFILIATION_TYPES = {
  DIRECTORATE:                       'directorate',
  SPECIALIZED_CENTERS_SECRETARIAT:   'specialized_centers_secretariat',
  TEACHING_HOSPITALS:                'teaching_hospitals',
  CURATIVE_ORG:                      'curative_org',
} as const;

export type AffiliationType = typeof AFFILIATION_TYPES[keyof typeof AFFILIATION_TYPES];

export const AFFILIATION_LABELS: Record<AffiliationType, string> = {
  directorate:                     'مديرية الشئون الصحية بالمحافظة',
  specialized_centers_secretariat: 'أمانة المراكز الطبية المتخصصة',
  teaching_hospitals:              'الهيئة العامة للمستشفيات والمعاهد التعليمية',
  curative_org:                    'المؤسسة العلاجية',
};

// تصنيفات المنصرفات الرسمية
export const EXPENDITURE_CLASSIFICATIONS = {
  STAFF_DUES:         'staff_dues',
  MEDICINE_SUPPLIES:  'medicine_supplies',
  PROCUREMENT_UPA:    'procurement_upa',
  CONTRACTS_SERVICES: 'contracts_services',
  LEGAL_ALLOCATIONS:  'legal_allocations',
} as const;

export const EXPENDITURE_CLASSIFICATION_LABELS = {
  staff_dues:         'مستحقات الكادر الطبي والإداري والمزايا',
  medicine_supplies:  'الأدوية والمستلزمات الطبية (التجنيب)',
  procurement_upa:    'مصروفات وفواتير هيئة الشراء الموحد',
  contracts_services: 'عقود الخدمات والتشغيل والصيانة',
  legal_allocations:  'أنصبة الصناديق والمشروعات (المادة 14)',
};

// أنواع التجنيب
export const DEDUCTION_TYPES = {
  STAFF_DUES:         'staff_dues',
  MEDICINE_SUPPLIES:  'medicine_supplies',
} as const;

export type DeductionType = typeof DEDUCTION_TYPES[keyof typeof DEDUCTION_TYPES];

export const DEDUCTION_TYPE_LABELS: Record<DeductionType, string> = {
  staff_dues:          'مستحقات عاملين',
  medicine_supplies:   'أدوية ومستلزمات',
};

// أنواع العقود
export const CONTRACT_TYPES = {
  SECURITY:      'security',
  CLEANING:      'cleaning',
  MAINTENANCE:   'maintenance',
  PATIENT_FOOD:  'patient_food',
  STAFF_FOOD:    'staff_food',
} as const;

export type ContractType = typeof CONTRACT_TYPES[keyof typeof CONTRACT_TYPES];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  security:      'أمن',
  cleaning:      'نظافة',
  maintenance:   'صيانة',
  patient_food:  'أغذية مرضى',
  staff_food:    'أغذية عاملين',
};

// أنواع مواد هيئة الشراء
export const PROCUREMENT_ITEM_TYPES = {
  MEDICINE:     'دواء',
  SUPPLIES:     'مستلزمات',
} as const;

// مصادر تمويل هيئة الشراء
export const FUNDING_SOURCES = {
  TREASURY:  'خزانة',
  FUND:      'صندوق',
} as const;

// أنواع الإجراءات في سجل التدقيق
export const AUDIT_ACTIONS = {
  CREATE:   'create',
  UPDATE:   'update',
  APPROVE:  'approve',
  DELETE:   'delete',
} as const;

// السنة المالية الحكومية المصرية: تبدأ يوليو
export const FISCAL_YEAR_START_MONTH = 7; // July

// هاتف الدعم الفني المعتمد
export const SUPPORT_PHONE = '01017799580';

// نطاقات الإقفال المالي الشهري
export const LOCK_SCOPES = {
  ALL: 'all',
  REVENUE: 'revenue',
  EXPENSES: 'expenses',
  DEDUCTIONS: 'deductions',
  NONE: 'none',
} as const;

export type LockScope = typeof LOCK_SCOPES[keyof typeof LOCK_SCOPES];

export const LOCK_SCOPE_LABELS: Record<string, string> = {
  all: '🔒 إقفال شامل (كافة العمليات)',
  revenue: '💰 إقفال الإيرادات فقط',
  expenses: '📦 إقفال المصروفات والتوريد فقط',
  deductions: '⚖️ إقفال التجنيب والعقود فقط',
  none: '🟢 مفتوح بالكامل',
};

// نظام الألوان الرسمي
export const COLORS = {
  primary:     '#1E5AA8',  // أزرق الوزارة
  accent:      '#C8102E',  // أحمر الوزارة
  background:  '#FBF7EC',  // كريمي
  success:     '#1E8A5F',  // أخضر — اعتماد
  warning:     '#E08E1F',  // برتقالي — تحذير
  text:        '#1F2937',  // نص رئيسي
  border:      '#E5E7EB',  // حدود
} as const;
