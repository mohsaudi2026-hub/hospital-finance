// ─────────────────────────────────────────────
// lib/utils/currency.ts
// تنسيق العملة المصرية — إلزامي في كل واجهة عرض
// الصيغة: 1,250,000.00 ج.م
// ─────────────────────────────────────────────

/**
 * تحويل رقم لصيغة العملة المصرية الرسمية
 * مثال: 1250000 → "1,250,000.00 ج.م"
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00 ج.م'

  return (
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount) + ' ج.م'
  )
}

/**
 * تحويل رقم لصيغة مختصرة للبطاقات الكبيرة (ألف / مليون / مليار)
 * مثال: 1250000 → "1.25 مليون ج.م"
 */
export function formatCurrencyShort(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '0 ج.م'

  const abs = Math.abs(amount)

  if (abs >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(2)} مليار ج.م`
  }
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)} مليون ج.م`
  }
  if (abs >= 1_000) {
    return `${(amount / 1_000).toFixed(2)} ألف ج.م`
  }

  return formatCurrency(amount)
}

/**
 * تحليل نص عملة وإعادة القيمة الرقمية
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '')
  return parseFloat(cleaned) || 0
}
