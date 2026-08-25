'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { MOHLogo } from '@/components/ui/MOHLogo'
import { UserAvatar } from '@/components/ui/UserAvatar'

export default function Navbar({ onMenuToggle }: { onMenuToggle: () => void }) {
  const router = useRouter()
  const supabase = createClient()
  const {
    fullName,
    email,
    role,
    roleLabel,
    isSuperAdmin,
    phone,
    nationalId,
    facilityName,
    facilityCode,
    facilityInstitutionalCode,
    directorateName,
    governorateName,
  } = useUserRole()

  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [copiedId, setCopiedId] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.refresh()
    router.push('/login')
  }

  const handleCopyNationalId = () => {
    if (nationalId) {
      navigator.clipboard.writeText(nationalId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  return (
    <header className="h-16 bg-white border-b border-[var(--color-border)] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Mobile Toggle Button & Ministry Header Branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl text-gray-600 hover:bg-gray-100 focus:outline-none transition-colors"
          aria-label="القائمة الرئيسية"
        >
          ☰
        </button>

        {/* Official MOH Logo & Title */}
        <div className="flex items-center gap-2.5">
          <MOHLogo size="sm" />
          <div>
            <span className="font-extrabold text-xs sm:text-sm text-[var(--color-text)] block leading-tight">
              وزارة الصحة والسكان
            </span>
            <span className="text-[10px] text-amber-700 font-semibold hidden sm:inline-block">
              المكتب الفني لمساعد الوزير — المنظومة المالية
            </span>
          </div>
        </div>
      </div>

      {/* User Info & Interactive Profile Dropdown */}
      <div className="flex items-center gap-3">
        {/* User Card Trigger */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-3 p-1.5 pr-2.5 rounded-2xl hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all cursor-pointer select-none text-right"
          >
            {/* Text details for medium/large screens */}
            <div className="hidden md:block leading-tight">
              <p className="text-xs font-bold text-[var(--color-text)] truncate max-w-[150px]">
                {fullName || 'مستخدم المنظومة'}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    isSuperAdmin ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                />
                <span className="text-[11px] text-[var(--color-muted)] font-medium truncate max-w-[140px]">
                  {roleLabel || email}
                </span>
              </div>
            </div>

            {/* User Avatar with Doctor / Executive Character */}
            <UserAvatar
              name={fullName}
              role={role}
              size="md"
              isOnline={true}
            />

            {/* Dropdown Chevron */}
            <span className={`text-[10px] text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>

          {/* Interactive Profile Dropdown Card */}
          {isDropdownOpen && (
            <div className="absolute left-0 mt-2 w-80 sm:w-88 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 space-y-4 animate-fadeIn z-50">
              {/* Profile Card Header */}
              <div className="flex items-start gap-3.5 pb-3.5 border-b border-gray-100">
                <UserAvatar
                  name={fullName}
                  role={role}
                  size="lg"
                  isOnline={true}
                />
                <div className="overflow-hidden flex-1">
                  <h4 className="font-extrabold text-sm text-gray-900 truncate">
                    {fullName || 'مستخدم المنظومة'}
                  </h4>
                  <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-[var(--color-primary)] border border-blue-100 mt-1">
                    {roleLabel}
                  </span>
                </div>
              </div>

              {/* Detailed User Information List */}
              <div className="space-y-2.5 text-xs">
                {/* Email */}
                {email && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/80 border border-gray-100">
                    <span className="text-gray-500 font-semibold flex items-center gap-1.5">
                      <span>✉️</span> البريد:
                    </span>
                    <span className="font-mono text-gray-800 text-[11px]" dir="ltr">
                      {email}
                    </span>
                  </div>
                )}

                {/* Phone */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/80 border border-gray-100">
                  <span className="text-gray-500 font-semibold flex items-center gap-1.5">
                    <span>📞</span> الهاتف:
                  </span>
                  <span className="font-mono text-gray-800 text-[11px]" dir="ltr">
                    {phone || 'غير مسجل'}
                  </span>
                </div>

                {/* National ID with 1-Click Copy */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-gray-50/80 border border-gray-100">
                  <span className="text-gray-500 font-semibold flex items-center gap-1.5">
                    <span>🪪</span> الرقم القومي:
                  </span>
                  {nationalId ? (
                    <button
                      onClick={handleCopyNationalId}
                      title="انقر للنسخ"
                      className="inline-flex items-center gap-1 font-mono text-gray-800 text-[11px] hover:text-[var(--color-primary)] transition-colors"
                    >
                      <span>{nationalId}</span>
                      <span className="text-[10px] text-gray-400">
                        {copiedId ? '✓ تم' : '📋'}
                      </span>
                    </button>
                  ) : (
                    <span className="text-amber-600 text-[10px] font-semibold">
                      يرجى الاستكمال ⚠️
                    </span>
                  )}
                </div>

                {/* Facility & Location info */}
                {facilityName ? (
                  <div className="p-2 rounded-xl bg-blue-50/60 border border-blue-100 space-y-1">
                    <div className="flex items-center gap-1 text-[var(--color-primary)] font-bold">
                      <span>🏥</span>
                      <span className="truncate">{facilityName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-600">
                      <span>كود: <b className="font-mono text-gray-800">{facilityCode || '—'}</b></span>
                      {facilityInstitutionalCode && (
                        <span>مؤسسي: <b className="font-mono text-gray-800">{facilityInstitutionalCode}</b></span>
                      )}
                    </div>
                    {(governorateName || directorateName) && (
                      <p className="text-[10px] text-gray-500 pt-0.5">
                        {governorateName} • {directorateName}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-gray-600 flex items-center gap-1.5">
                    <span>🏛️</span>
                    <span>النطاق العام: ديوان عام وزارة الصحة والسكان</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                <Link
                  href="/change-password"
                  onClick={() => setIsDropdownOpen(false)}
                  className="btn btn-ghost !min-h-[34px] !py-1 !px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 flex-1 justify-center rounded-xl"
                >
                  🔑 تغيير كلمة المرور
                </Link>

                <button
                  onClick={handleLogout}
                  className="btn btn-ghost !min-h-[34px] !py-1 !px-3 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-xl"
                  title="تسجيل الخروج من الحساب"
                >
                  خروج 🚪
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
