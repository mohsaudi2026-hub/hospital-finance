'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { formatCurrency } from '@/lib/utils/currency'

interface AuditItem {
  id: string
  action: string
  table_name: string
  record_id: string | null
  old_value: any
  new_value: any
  created_at: string
  user_id?: string
  profiles?: {
    full_name: string
    email?: string
  }
  facilities?: {
    name: string
    code: string
  }
}

interface Facility {
  id: string
  name: string
  code: string
}

const TABLE_LABELS: Record<string, { label: string; icon: string }> = {
  revenue_entries: { label: 'الإيرادات الذاتية', icon: '💰' },
  deductions: { label: 'التجنيب والاستقطاع', icon: '⚖️' },
  contracts: { label: 'عقود الخدمات والتشغيل', icon: '📝' },
  contract_payments: { label: 'سداد أقساط العقود', icon: '💳' },
  procurement_orders: { label: 'مصروفات الشراء الموحد', icon: '📦' },
  monthly_closures: { label: 'الاعتماد والإقفال الشهري', icon: '🔒' },
  monthly_deadlines: { label: 'مهل ومواعيد الإقفال', icon: '⏱️' },
  user_facility_roles: { label: 'صلاحيات المستخدمين', icon: '👥' },
  profiles: { label: 'حسابات المستخدمين', icon: '👤' },
}

const ACTION_LABELS: Record<string, { label: string; badge: string; icon: string }> = {
  create: { label: 'إضافة قيد جديد', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', icon: '➕' },
  update: { label: 'تعديل استثنائي', badge: 'bg-amber-100 text-amber-800 border-amber-300', icon: '✏️' },
  approve: { label: 'اعتماد وإقفال رسمي', badge: 'bg-blue-100 text-blue-800 border-blue-300', icon: '🔒' },
  delete: { label: 'حذف سجل', badge: 'bg-red-100 text-red-800 border-red-300', icon: '🗑️' },
}

export default function AuditLogPage() {
  const supabase = createClient()
  const { isSuperAdmin, isMinistryViewer } = useUserRole()

  const [logs, setLogs] = useState<AuditItem[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterAction, setFilterAction] = useState('all')
  const [filterTable, setFilterTable] = useState('all')
  const [filterFacility, setFilterFacility] = useState('all')

  // Selected Log for Diff Modal
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null)

  // 1. جلب المنشآت
  useEffect(() => {
    async function loadFacilities() {
      const { data } = await supabase.from('facilities').select('id, name, code').order('name')
      if (data) setFacilities(data)
    }
    loadFacilities()
  }, [])

  // 2. جلب سجل التدقيق
  async function loadLogs() {
    setLoading(true)
    try {
      let query = supabase
        .from('audit_log')
        .select(`
          *,
          profiles ( full_name, email ),
          facilities ( name, code )
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (filterAction !== 'all') {
        query = query.eq('action', filterAction as any)
      }
      if (filterTable !== 'all') {
        query = query.eq('table_name', filterTable)
      }
      if (filterFacility !== 'all') {
        query = query.eq('facility_id', filterFacility)
      }

      const { data } = await query
      if (data) setLogs(data as any)
      else setLogs([])
    } catch (err) {
      console.error('Error loading audit logs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [filterAction, filterTable, filterFacility])

  // Helper formatting for diff values
  function renderValueFormatted(val: any) {
    if (val === null || val === undefined) return <span className="text-gray-400 font-mono">null</span>
    if (typeof val === 'number') return <span className="font-mono font-bold">{formatCurrency(val)}</span>
    if (typeof val === 'boolean') return <span className="font-mono">{val ? 'صحيح (True)' : 'خطأ (False)'}</span>
    if (typeof val === 'object') {
      return (
        <pre className="text-[11px] font-mono p-3 bg-gray-900 text-green-400 rounded-xl overflow-x-auto text-left" dir="ltr">
          {JSON.stringify(val, null, 2)}
        </pre>
      )
    }
    return <span className="font-mono text-gray-800">{String(val)}</span>
  }

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-xl sm:text-2xl font-black text-[var(--color-text)] flex items-center gap-2">
            <span>🛡️</span>
            <span>سجل التدقيق والمراقبة المالي (Financial Audit Trail)</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            سجل تاريخي مشفر وغير قابل للتعديل لتوثيق جميع العمليات والتعديلات الاستثنائية وحسابات المنفذين
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="btn btn-outline !min-h-[34px] !py-1 text-xs font-bold flex items-center gap-1.5"
          >
            <span>🔄</span>
            <span>تحديث السجل</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card !p-4 bg-white border border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* نوع الإجراء */}
          <div>
            <label className="form-label text-xs mb-1 font-bold">نوع الإجراء والعملية:</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="form-input !min-h-[36px] !py-1 text-xs"
            >
              <option value="all">جميع الإجراءات</option>
              <option value="create">➕ إضافة قيد جديد</option>
              <option value="update">✏️ تعديل استثنائي</option>
              <option value="approve">🔒 اعتماد وإقفال</option>
              <option value="delete">🗑️ حذف</option>
            </select>
          </div>

          {/* الباب المالي / الجدول */}
          <div>
            <label className="form-label text-xs mb-1 font-bold">الباب المالي / السجل:</label>
            <select
              value={filterTable}
              onChange={(e) => setFilterTable(e.target.value)}
              className="form-input !min-h-[36px] !py-1 text-xs"
            >
              <option value="all">جميع الأبواب المالية</option>
              {Object.entries(TABLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* المنشأة الطبية */}
          <div>
            <label className="form-label text-xs mb-1 font-bold">المستشفى / المنشأة:</label>
            <select
              value={filterFacility}
              onChange={(e) => setFilterFacility(e.target.value)}
              className="form-input !min-h-[36px] !py-1 text-xs"
            >
              <option value="all">جميع المنشآت الطبية</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card shadow-sm border border-[var(--color-border)] !p-0 overflow-hidden">
        <div className="p-4 bg-gray-50/80 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <div>
              <h3 className="section-title text-sm sm:text-base">سجلات الحركات والتعديلات المسجلة</h3>
              <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
                يتم التوثيق الفوري مع تفاصيل القيم السابقة والجديدة
              </p>
            </div>
          </div>
          <span className="badge badge-info font-mono text-xs font-bold">
            {logs.length} حركة مسجلة
          </span>
        </div>

        <div className="table-wrapper">
          <table className="table w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                <th className="py-3 px-3 text-center w-12">م</th>
                <th className="py-3 px-4 text-right">توقيت العملية</th>
                <th className="py-3 px-4 text-center">نوع الإجراء</th>
                <th className="py-3 px-4 text-right">الباب المالي المتأثر</th>
                <th className="py-3 px-4 text-right">المستخدم المُنفِّذ</th>
                <th className="py-3 px-4 text-right">المنشأة الطبية</th>
                <th className="py-3 px-4 text-center w-28">فحص الفروق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">جاري تحميل سجل التدقيق المالي...</p>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    لا توجد حركات مسجلة تطابق خيارات الفلترة المحددة
                  </td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const act = ACTION_LABELS[log.action] || {
                    label: log.action,
                    badge: 'bg-gray-100 text-gray-700 border-gray-200',
                    icon: '⚙️',
                  }
                  const tbl = TABLE_LABELS[log.table_name] || {
                    label: log.table_name,
                    icon: '📁',
                  }

                  return (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3 px-3 text-center text-gray-500 font-bold">{idx + 1}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                        {new Date(log.created_at).toLocaleString('ar-EG', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${act.badge}`}>
                          <span>{act.icon}</span>
                          <span>{act.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-900">
                        <span className="flex items-center gap-1.5">
                          <span>{tbl.icon}</span>
                          <span>{tbl.label}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-blue-900">
                        {log.profiles?.full_name || 'مسؤول النظام (Super Admin)'}
                      </td>
                      <td className="py-3 px-4 text-gray-700 font-semibold">
                        {log.facilities?.name ? (
                          <span>
                            🏥 {log.facilities.name}{' '}
                            <span className="text-gray-400 text-[10px]">({log.facilities.code})</span>
                          </span>
                        ) : (
                          <span className="badge badge-info text-[10px]">الديوان العام / الوزارة</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedLog(log)}
                          className="btn btn-outline !min-h-[30px] !py-1 !px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 border-blue-300 flex items-center justify-center gap-1 mx-auto"
                        >
                          <span>🔍</span>
                          <span>معاينة الفروق</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          نافذة فحص الفروق وتفاصيل التعديل (Audit Diff Modal)
      ───────────────────────────────────────────── */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-blue-200 p-6 space-y-5 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-center text-2xl shadow-xs shrink-0">
                  🔍
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                    تفاصيل حركة التدقيق المالي وفحص الفروق
                  </h3>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Quick Meta Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-semibold">
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 block">المستخدم المُنفِّذ:</span>
                <span className="font-bold text-gray-900">{selectedLog.profiles?.full_name || 'سوبر أدمن'}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 block">نوع الإجراء:</span>
                <span className="font-bold text-amber-800">{ACTION_LABELS[selectedLog.action]?.label || selectedLog.action}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 block">الباب المالي:</span>
                <span className="font-bold text-blue-900">{TABLE_LABELS[selectedLog.table_name]?.label || selectedLog.table_name}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                <span className="text-[10px] text-gray-500 block">التوقيت:</span>
                <span className="font-mono text-gray-800 text-[11px]">
                  {new Date(selectedLog.created_at).toLocaleTimeString('ar-EG')}
                </span>
              </div>
            </div>

            {/* Diff Comparison (Before vs After) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Old Value */}
              <div className="p-4 rounded-2xl bg-red-50/60 border border-red-200 space-y-2">
                <div className="flex items-center gap-1.5 text-red-900 font-extrabold text-xs">
                  <span>🔴</span>
                  <span>القيمة السابقة (قبل التعديل):</span>
                </div>
                <div className="text-xs">
                  {renderValueFormatted(selectedLog.old_value)}
                </div>
              </div>

              {/* New Value */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold text-xs">
                  <span>🟢</span>
                  <span>القيمة الجديدة (بعد التعديل):</span>
                </div>
                <div className="text-xs">
                  {renderValueFormatted(selectedLog.new_value)}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="btn btn-primary text-xs !px-6"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
