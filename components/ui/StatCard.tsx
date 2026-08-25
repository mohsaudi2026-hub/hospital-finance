import React from 'react'

interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: string
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'accent'
  trend?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  trend,
}: StatCardProps) {
  const borderColors = {
    default: 'border-[var(--color-border)]',
    primary: 'border-r-4 border-r-[var(--color-primary)]',
    success: 'border-r-4 border-r-[var(--color-success)]',
    warning: 'border-r-4 border-r-[var(--color-warning)]',
    accent:  'border-r-4 border-r-[var(--color-accent)]',
  }

  const iconBg = {
    default: 'bg-gray-100 text-gray-700',
    primary: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
    success: 'bg-[#DCFCE7] text-[var(--color-success)]',
    warning: 'bg-[#FEF9C3] text-[#854D0E]',
    accent:  'bg-[#FEE2E2] text-[var(--color-accent)]',
  }

  return (
    <div className={`card ${borderColors[variant]} relative overflow-hidden transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-[var(--color-muted)]">{title}</p>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-text)]">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-[var(--color-muted)] font-medium pt-1">{subtitle}</p>
          )}
          {trend && (
            <span className="inline-block text-[11px] font-semibold text-[var(--color-success)] bg-green-50 px-2 py-0.5 rounded-full mt-1">
              {trend}
            </span>
          )}
        </div>
        {icon && (
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${iconBg[variant]}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
