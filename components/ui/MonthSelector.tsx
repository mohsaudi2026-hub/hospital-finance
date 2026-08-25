'use client'

import { getAvailableMonths, formatMonthArabic } from '@/lib/utils/date'

interface MonthSelectorProps {
  selectedMonth: string
  onChange: (month: string) => void
  label?: string
}

export function MonthSelector({
  selectedMonth,
  onChange,
  label = 'الشهر المالي',
}: MonthSelectorProps) {
  const months = getAvailableMonths()

  return (
    <div className="flex items-center gap-3 bg-white p-2 px-3.5 rounded-xl border border-[var(--color-border)] shadow-xs">
      <span className="text-xs font-bold text-[var(--color-muted)] whitespace-nowrap">
        📅 {label}:
      </span>
      <select
        value={selectedMonth}
        onChange={(e) => onChange(e.target.value)}
        className="form-input !min-h-[36px] !py-1 text-xs font-semibold bg-transparent border-0 focus:ring-0 cursor-pointer"
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  )
}
