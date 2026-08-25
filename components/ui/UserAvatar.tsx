import React from 'react'

export type AvatarType = 'doctor' | 'admin' | 'finance' | 'entry' | 'viewer' | 'generic'

interface UserAvatarProps {
  name?: string | null
  role?: string | null
  type?: AvatarType
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  showBadge?: boolean
  isOnline?: boolean
}

export function UserAvatar({
  name,
  role,
  type,
  size = 'md',
  className = '',
  showBadge = true,
  isOnline = true,
}: UserAvatarProps) {
  // تحديد نوع ومظهر الأيقونة حسب الدور
  const resolvedType: AvatarType =
    type ||
    (role === 'super_admin'
      ? 'admin'
      : role === 'hospital_admin'
      ? 'doctor'
      : role === 'ministry_viewer'
      ? 'finance'
      : role === 'hospital_data_entry'
      ? 'entry'
      : role === 'hospital_viewer'
      ? 'viewer'
      : 'generic')

  const sizeConfig = {
    xs: { box: 'w-7 h-7 text-[11px]', icon: 'w-3.5 h-3.5', badge: 'w-2 h-2 -bottom-0.5 -right-0.5' },
    sm: { box: 'w-8 h-8 text-xs', icon: 'w-4 h-4', badge: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5' },
    md: { box: 'w-10 h-10 text-sm', icon: 'w-5 h-5', badge: 'w-3 h-3 -bottom-0.5 -right-0.5' },
    lg: { box: 'w-12 h-12 text-base', icon: 'w-6 h-6', badge: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5' },
    xl: { box: 'w-16 h-16 text-xl', icon: 'w-8 h-8', badge: 'w-4 h-4 -bottom-1 -right-1' },
  }[size]

  // ثيمات أنيقة وبسيطة ومميزة لكل فئة
  const theme = {
    admin: {
      bg: 'bg-gradient-to-tr from-rose-700 via-rose-600 to-amber-600',
      border: 'border-rose-200',
      ring: 'ring-rose-100',
      badgeBg: 'bg-amber-400',
      icon: (
        <svg className={sizeConfig.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {/* تاج / شيلد القيادة */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    doctor: {
      bg: 'bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-500',
      border: 'border-blue-200',
      ring: 'ring-blue-100',
      badgeBg: 'bg-emerald-400',
      icon: (
        <svg className={sizeConfig.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {/* شارة الإدارة الطبية / المستشفى */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    finance: {
      bg: 'bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-500',
      border: 'border-emerald-200',
      ring: 'ring-emerald-100',
      badgeBg: 'bg-emerald-400',
      icon: (
        <svg className={sizeConfig.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {/* تحليلات مالية ومتابعة */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    entry: {
      bg: 'bg-gradient-to-tr from-amber-600 via-amber-500 to-orange-400',
      border: 'border-amber-200',
      ring: 'ring-amber-100',
      badgeBg: 'bg-blue-400',
      icon: (
        <svg className={sizeConfig.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {/* تسجيل وتدوين بيانات */}
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
    },
    viewer: {
      bg: 'bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-400',
      border: 'border-indigo-200',
      ring: 'ring-indigo-100',
      badgeBg: 'bg-emerald-400',
      icon: (
        <svg className={sizeConfig.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    generic: {
      bg: 'bg-gradient-to-tr from-slate-700 via-gray-600 to-zinc-500',
      border: 'border-gray-200',
      ring: 'ring-gray-100',
      badgeBg: 'bg-emerald-400',
      icon: (
        <svg className={sizeConfig.icon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  }[resolvedType]

  // أول حرفين من الاسم إن وجد
  const firstLetter = name ? name.trim().charAt(0) : null

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`
          ${sizeConfig.box}
          ${theme.bg}
          rounded-2xl flex items-center justify-center
          text-white shadow-xs border-2 ${theme.border}
          overflow-hidden select-none transition-transform hover:scale-105
        `}
        title={name || 'المستخدم'}
      >
        {theme.icon}
      </div>

      {showBadge && (
        <span
          className={`
            absolute ${sizeConfig.badge}
            ${isOnline ? theme.badgeBg : 'bg-gray-400'}
            rounded-full ring-2 ring-white shadow-xs
          `}
          title={isOnline ? 'نشط الآن' : 'غير متصل'}
        />
      )}
    </div>
  )
}
