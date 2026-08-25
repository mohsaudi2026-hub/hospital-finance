'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { MOHLogo } from '@/components/ui/MOHLogo'
import { getFiscalYear } from '@/lib/utils/date'

interface NavSection {
  title: string
  items: {
    href: string
    label: string
    icon: string
    roles?: string[]
  }[]
}

const navSections: NavSection[] = [
  {
    title: 'المؤشرات والتقارير',
    items: [
      {
        href: '/dashboard',
        label: 'لوحة المؤشرات العامة',
        icon: '📊',
      },
      {
        href: '/reports',
        label: 'مركز التقارير والتصدير',
        icon: '📑',
      },
    ],
  },
  {
    title: 'العمليات المالية والتشغيلية',
    items: [
      {
        href: '/revenue',
        label: 'الإيرادات',
        icon: '💰',
        roles: ['super_admin', 'hospital_admin', 'hospital_data_entry', 'hospital_viewer'],
      },
      {
        href: '/deductions',
        label: 'التجنيب والاستقطاع',
        icon: '⚖️',
        roles: ['super_admin', 'hospital_admin', 'hospital_data_entry', 'hospital_viewer'],
      },
      {
        href: '/procurement',
        label: 'هيئة الشراء الموحد',
        icon: '📦',
        roles: ['super_admin', 'hospital_admin', 'hospital_data_entry', 'hospital_viewer'],
      },
      {
        href: '/contracts',
        label: 'العقود وسداد الخدمات',
        icon: '📝',
        roles: ['super_admin', 'hospital_admin', 'hospital_data_entry', 'hospital_viewer'],
      },
    ],
  },
  {
    title: 'إدارة المنظومة واللوائح',
    items: [
      {
        href: '/admin/facilities',
        label: 'قائمة المنشآت',
        icon: '🏥',
        roles: ['super_admin'],
      },
      {
        href: '/admin/users',
        label: 'المستخدمون والصلاحيات',
        icon: '👥',
        roles: ['super_admin', 'hospital_admin'],
      },
      {
        href: '/admin/settings',
        label: 'الإعدادات',
        icon: '⚙️',
        roles: ['super_admin'],
      },
      {
        href: '/admin/audit',
        label: 'سجل التدقيق والمراقبة',
        icon: '🔍',
        roles: ['super_admin', 'ministry_viewer'],
      },
    ],
  },
]

export default function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { role, isSuperAdmin, facilityName, facilityCode, facilityInstitutionalCode } = useUserRole()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 bottom-0 right-0 z-50 w-72 bg-white border-l border-[var(--color-border)]
          flex flex-col transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
        style={{ background: '#FFFFFF', boxShadow: 'var(--shadow-sm)' }}
      >
        {/* Logo & Header */}
        <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <MOHLogo size="md" />
            <div>
              <h1 className="font-bold text-xs leading-tight text-[var(--color-text)]">
                وزارة الصحة والسكان
              </h1>
              <p className="text-[11px] text-amber-700 font-semibold">
                المكتب الفني لمساعد الوزير
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
          >
            ✕
          </button>
        </div>

        {/* Facility Info Card in Sidebar (for hospital roles) */}
        {facilityName && (
          <div className="mx-4 my-3 p-3 rounded-xl bg-[var(--color-primary-light)] border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🏥</span>
              <p className="text-xs font-bold text-[var(--color-primary)] truncate">
                {facilityName}
              </p>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[var(--color-muted)]">
              <span>كود: <b className="text-[var(--color-text)]">{facilityCode}</b></span>
              {facilityInstitutionalCode && (
                <span>مؤسسي: <b className="text-[var(--color-text)]">{facilityInstitutionalCode}</b></span>
              )}
            </div>
          </div>
        )}

        {/* Navigation List grouped by categories */}
        <nav className="flex-1 overflow-y-auto p-3.5 space-y-5">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (!item.roles) return true
              if (isSuperAdmin) return true
              if (!role) return false
              return item.roles.includes(role)
            })

            if (visibleItems.length === 0) return null

            return (
              <div key={section.title} className="space-y-1">
                <p className="px-3 text-[10px] font-extrabold text-[var(--color-muted)] uppercase tracking-wider mb-1.5">
                  {section.title}
                </p>

                {visibleItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`
                        flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all
                        ${
                          isActive
                            ? 'bg-[var(--color-primary)] text-white shadow-sm'
                            : 'text-gray-700 hover:bg-gray-100 hover:text-[var(--color-primary)]'
                        }
                      `}
                    >
                      <span className="text-sm shrink-0">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Footer with Fiscal Year and Months */}
        <div className="p-3 border-t border-[var(--color-border)] text-center text-[11px] text-[var(--color-muted)] bg-gray-50/90 leading-tight">
          <span>السنة المالية: </span>
          <b className="text-[var(--color-primary)] font-mono font-bold">
            {getFiscalYear(new Date())} / {getFiscalYear(new Date()) + 1}
          </b>
          <span className="block text-[10px] text-gray-500 mt-0.5 font-medium">
            (يوليو — يونيو)
          </span>
        </div>
      </aside>
    </>
  )
}
