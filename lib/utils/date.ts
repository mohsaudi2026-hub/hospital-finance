// ─────────────────────────────────────────────
// lib/utils/date.ts
// دوال التواريخ — السنة المالية يوليو-يونيو
// ─────────────────────────────────────────────

import { FISCAL_YEAR_START_MONTH } from '@/lib/constants'

/**
 * تحويل تاريخ لأول يوم في الشهر (YYYY-MM-01)
 * مطلوب لحقل month في كل الجداول المالية
 */
export function toFirstOfMonth(date: Date): string {
  const year  = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

/**
 * تحليل YYYY-MM-01 وإعادة Date
 */
export function parseMonthDate(value: string): Date {
  return new Date(value + 'T00:00:00')
}

/**
 * تنسيق الشهر للعرض العربي
 * مثال: "2026-08-01" → "أغسطس 2026"
 */
export function formatMonthArabic(monthStr: string): string {
  const date = parseMonthDate(monthStr)
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    year: 'numeric',
    month: 'long',
  }).format(date)
}

/**
 * السنة المالية الحكومية المصرية (يوليو-يونيو)
 * مثال: يناير 2026 → السنة المالية 2025/2026
 */
export function getFiscalYear(date: Date): number {
  const month = date.getMonth() + 1 // 1-12
  const year  = date.getFullYear()
  return month >= FISCAL_YEAR_START_MONTH ? year : year - 1
}

/**
 * الربع المالي (1-4) حسب السنة المالية يوليو-يونيو
 * Q1: يوليو-سبتمبر | Q2: أكتوبر-ديسمبر | Q3: يناير-مارس | Q4: أبريل-يونيو
 */
export function getFiscalQuarter(date: Date): number {
  const month = date.getMonth() + 1
  if (month >= 7 && month <= 9)   return 1
  if (month >= 10 && month <= 12) return 2
  if (month >= 1 && month <= 3)   return 3
  return 4
}

/**
 * هل التاريخ في المستقبل؟ (لمنع اختيار شهر مستقبلي)
 */
export function isFutureMonth(monthStr: string): boolean {
  const selected = parseMonthDate(monthStr)
  const now = new Date()
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return selected > currentMonth
}

/**
 * الشهور المتاحة (من بداية السنة المالية الحالية حتى الشهر الحالي)
 */
export function getAvailableMonths(): { value: string; label: string }[] {
  const now = new Date()
  const fiscalYear = getFiscalYear(now)
  const startDate = new Date(fiscalYear, FISCAL_YEAR_START_MONTH - 1, 1) // يوليو

  const months: { value: string; label: string }[] = []
  const current = new Date(startDate)

  while (current <= new Date(now.getFullYear(), now.getMonth(), 1)) {
    const value = toFirstOfMonth(current)
    months.push({ value, label: formatMonthArabic(value) })
    current.setMonth(current.getMonth() + 1)
  }

  return months.reverse() // الأحدث أولاً
}
