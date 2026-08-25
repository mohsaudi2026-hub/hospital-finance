'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { FormField } from '@/components/ui/FormField'
import { formatMonthArabic } from '@/lib/utils/date'

interface DistItem {
  id: string
  label: string
  percentage: number
  display_order: number
}

interface RevenueSrc {
  id: string
  label: string
  display_order: number
}

interface Announcement {
  id: string
  title: string
  body: string
  is_active: boolean
}

interface MonthDeadline {
  month: string
  deadline_date: string
  is_locked: boolean
  lock_scope: string
  notes: string | null
}

export default function AdminSettingsPage() {
  const supabase = createClient()
  const { isSuperAdmin } = useUserRole()

  const [distItems, setDistItems] = useState<DistItem[]>([])
  const [staffItems, setStaffItems] = useState<DistItem[]>([])
  const [sources, setSources] = useState<RevenueSrc[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [deadlines, setDeadlines] = useState<MonthDeadline[]>([])
  const [savingDeadlines, setSavingDeadlines] = useState(false)
  const [newAnn, setNewAnn] = useState({ title: '', body: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadSettings() {
    setLoading(true)
    try {
      const { data: dData } = await supabase.from('distribution_percentages').select('*').order('display_order')
      const { data: sData } = await supabase.from('staff_distribution_percentages').select('*').order('display_order')
      const { data: rData } = await supabase.from('revenue_sources').select('*').order('display_order')
      const { data: aData } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
      const { data: dlData } = await supabase.from('monthly_deadlines').select('*').order('month', { ascending: false })

      if (dData) setDistItems(dData as any)
      if (sData) setStaffItems(sData as any)
      if (rData) setSources(rData as any)
      if (aData) setAnnouncements(aData as any)
      if (dlData && dlData.length > 0) {
        setDeadlines(dlData as any)
      } else {
        // Default months if table was just created
        setDeadlines([
          { month: '2026-07-01', deadline_date: '2026-08-10', is_locked: false, lock_scope: 'all', notes: 'مهلة تسجيل شهر يوليو' },
          { month: '2026-08-01', deadline_date: '2026-09-10', is_locked: false, lock_scope: 'all', notes: 'مهلة تسجيل شهر أغسطس' },
          { month: '2026-09-01', deadline_date: '2026-10-10', is_locked: false, lock_scope: 'all', notes: 'مهلة تسجيل شهر سبتمبر' },
          { month: '2026-10-01', deadline_date: '2026-11-10', is_locked: false, lock_scope: 'all', notes: 'مهلة تسجيل شهر أكتوبر' },
          { month: '2026-11-01', deadline_date: '2026-12-10', is_locked: false, lock_scope: 'all', notes: 'مهلة تسجيل شهر نوفمبر' },
          { month: '2026-12-01', deadline_date: '2027-01-10', is_locked: false, lock_scope: 'all', notes: 'مهلة تسجيل شهر ديسمبر' },
        ])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // حفظ مواعيد الإقفال
  async function handleSaveDeadlines(e: React.FormEvent) {
    e.preventDefault()
    setSavingDeadlines(true)
    setMsg(null)
    try {
      for (const dl of deadlines) {
        await supabase.from('monthly_deadlines').upsert({
          month: dl.month,
          deadline_date: dl.deadline_date,
          is_locked: dl.is_locked,
          lock_scope: dl.lock_scope || 'all',
          notes: dl.notes || null,
          updated_at: new Date().toISOString(),
        })
      }
      setMsg({ type: 'success', text: 'تم تحديث وحفظ مواعيد الإقفال ومهل التسجيل الشهرية بنجاح!' })
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ مواعيد الإقفال' })
    } finally {
      setSavingDeadlines(false)
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  // إضافة إعلان جديد
  async function handleAddAnnouncement(e: React.FormEvent) {
    e.preventDefault()
    if (!newAnn.title || !newAnn.body) return
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

      const { error } = await supabase.from('announcements').insert({
        title: newAnn.title.trim(),
        body: newAnn.body.trim(),
        is_active: true,
        created_by: user.id,
      })

      if (error) throw error

      setNewAnn({ title: '', body: '' })
      setMsg({ type: 'success', text: 'تم نشر الإعلان بنجاح!' })
      await loadSettings()
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء إضافة الإعلان' })
    } finally {
      setSaving(false)
    }
  }

  const totalDist = distItems.reduce((sum, item) => sum + Number(item.percentage), 0)

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="page-title text-xl sm:text-2xl font-black text-[var(--color-text)] flex items-center gap-2">
          <span>⚙️</span>
          <span>الإعدادات</span>
        </h1>
        <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
          إدارة نسب التوزيع الرسمية (المادتين 14 و15)، مصادر الإيراد، والإعلانات العامة
        </p>
      </div>

      {msg && (
        <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>
          {msg.type === 'success' ? '✓ ' : '⚠️ '} {msg.text}
        </div>
      )}

      {/* 1. بنود توزيع الموارد الذاتية (المادة 14) */}
      <div className="card space-y-4">
        <div className="card-header flex items-center justify-between">
          <div>
            <h3 className="section-title">قواعد توزيع حصيلة الموارد الذاتية — المادة (14)</h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              توزيع حصيلة حساب صندوق تحسين الخدمة بالمستشفى
            </p>
          </div>
          <span className={`badge ${totalDist === 100 ? 'badge-success' : 'badge-warning'} font-bold`}>
            المجموع: {totalDist}%
          </span>
        </div>

        <div className="space-y-2">
          {distItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl border border-[var(--color-border)] flex items-center justify-between bg-white text-xs sm:text-sm"
            >
              <span className="font-semibold text-[var(--color-text)]">{item.label}</span>
              <span className="font-bold text-[var(--color-primary)] text-sm">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. توزيع الـ 50% مزايا العاملين (المادة 15) */}
      <div className="card space-y-4">
        <div className="card-header flex items-center justify-between">
          <div>
            <h3 className="section-title">التوزيع التفصيلي لنسبة الـ 50% للعاملين — المادة (15)</h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5">
              توزيع المزايا المالية الإضافية بين مختلف فئات العاملين بالمنشأة
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {staffItems.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl border border-[var(--color-border)] flex items-center justify-between bg-white text-xs"
            >
              <span className="font-medium text-[var(--color-text)]">{item.label}</span>
              <span className="font-bold text-[var(--color-primary)] whitespace-nowrap mr-2">
                {item.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. مصادر الإيراد الرسمية الـ 8 */}
      <div className="card space-y-4">
        <div className="card-header">
          <h3 className="section-title">مصادر الإيراد الرسمية لصندوق تحسين الخدمة (8 مصادر)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sources.map((src, idx) => (
            <div
              key={src.id}
              className="p-3 rounded-xl border border-[var(--color-border)] flex items-center gap-3 bg-white text-xs sm:text-sm"
            >
              <span className="w-6 h-6 rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center font-bold text-xs">
                {idx + 1}
              </span>
              <span className="font-semibold text-[var(--color-text)]">{src.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. جدول مواعيد الإقفال ومهل التسجيل الشهرية للمستشفيات */}
      {isSuperAdmin && (
        <div className="card space-y-6">
          <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="section-title flex items-center gap-2">
                <span>⏳</span> مواعيد الإقفال ومهل التسجيل الشهرية
              </h3>
              <p className="text-xs text-[var(--color-muted)] mt-0.5">
                تحديد تاريخ انتهاء مهلة تسجيل وتعديل البيانات لكل شهر لمنع أي إدخال خاطئ في شهور سابقة
              </p>
            </div>

            <button
              onClick={handleSaveDeadlines}
              disabled={savingDeadlines}
              className="btn btn-primary !min-h-[36px] !py-1 text-xs font-bold shadow-xs"
            >
              {savingDeadlines ? 'جاري الحفظ...' : 'حفظ مواعيد الإقفال 💾'}
            </button>
          </div>

          <div className="table-wrapper">
            <table className="table w-full text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <th className="py-2.5 px-3 text-right">الشهر المالي</th>
                  <th className="py-2.5 px-3 text-right">تاريخ نهاية المهلة (ميعاد الإقفال)</th>
                  <th className="py-2.5 px-3 text-right">نوع ونطاق الإقفال</th>
                  <th className="py-2.5 px-3 text-center">القفل الاستثنائي</th>
                  <th className="py-2.5 px-3 text-right">ملاحظات وزارية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {deadlines.map((dl, idx) => {
                  const monthName = formatMonthArabic(dl.month)
                  const isExpired = new Date(dl.deadline_date) < new Date(new Date().toDateString())

                  return (
                    <tr key={dl.month} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{monthName}</span>
                          <span className="text-[10px] text-gray-400 font-mono">({dl.month})</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={dl.deadline_date}
                            onChange={(e) => {
                              const updated = [...deadlines]
                              updated[idx].deadline_date = e.target.value
                              setDeadlines(updated)
                            }}
                            className="form-input !min-h-[32px] !py-0.5 text-xs font-mono max-w-[150px]"
                          />
                          {isExpired ? (
                            <span className="badge badge-error text-[10px]">انتهت المهلة</span>
                          ) : (
                            <span className="badge badge-success text-[10px]">مفتوح</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <select
                          value={dl.lock_scope || 'all'}
                          onChange={(e) => {
                            const updated = [...deadlines]
                            updated[idx].lock_scope = e.target.value
                            setDeadlines(updated)
                          }}
                          className="form-input !min-h-[32px] !py-0.5 text-xs font-bold"
                        >
                          <option value="all">🔒 إقفال شامل (كافة العمليات)</option>
                          <option value="revenue">💰 إقفال الإيرادات فقط</option>
                          <option value="expenses">📦 إقفال المصروفات والتوريد فقط</option>
                          <option value="deductions">⚖️ إقفال التجنيب والعقود فقط</option>
                          <option value="none">🟢 مفتوح بالكامل</option>
                        </select>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dl.is_locked}
                            onChange={(e) => {
                              const updated = [...deadlines]
                              updated[idx].is_locked = e.target.checked
                              setDeadlines(updated)
                            }}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span
                            className={`text-[11px] font-bold ${
                              dl.is_locked ? 'text-red-700' : 'text-gray-500'
                            }`}
                          >
                            {dl.is_locked ? '🔒 مقفل' : 'متاح'}
                          </span>
                        </label>
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="text"
                          placeholder="توجيه أو ملاحظة للمستشفيات..."
                          value={dl.notes || ''}
                          onChange={(e) => {
                            const updated = [...deadlines]
                            updated[idx].notes = e.target.value
                            setDeadlines(updated)
                          }}
                          className="form-input !min-h-[32px] !py-0.5 text-xs"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. لوحة الإعلانات العامة (تظهر في شاشة تسجيل الدخول) */}
      <div className="card space-y-6">
        <div className="card-header">
          <h3 className="section-title">إعلانات وتنبيهات شاشة تسجيل الدخول</h3>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            الإعلانات المنشورة هنا تظهر مباشرة في اللوحة الجانبية لشاشة تسجيل الدخول
          </p>
        </div>

        {/* New announcement form */}
        {isSuperAdmin && (
          <form onSubmit={handleAddAnnouncement} className="space-y-4 p-4 rounded-xl bg-gray-50 border border-[var(--color-border)]">
            <h4 className="font-bold text-xs text-[var(--color-text)]">➕ نشر إعلان أو تنبيه جديد</h4>
            <FormField
              label="عنوان الإعلان"
              required
              placeholder="مثال: موعد إقفال سجلات شهر أغسطس 2026"
              value={newAnn.title}
              onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
            />
            <div>
              <label className="form-label text-xs">نص الإعلان</label>
              <textarea
                required
                rows={2}
                placeholder="نص التنبيه أو التوجيه الوزاري..."
                value={newAnn.body}
                onChange={(e) => setNewAnn({ ...newAnn, body: e.target.value })}
                className="form-input text-xs"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving || !newAnn.title || !newAnn.body} className="btn btn-primary !min-h-[36px] !py-1 text-xs">
                {saving ? 'جاري النشر...' : 'نشر الإعلان 📢'}
              </button>
            </div>
          </form>
        )}

        {/* Existing Announcements List */}
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <p className="text-xs text-[var(--color-muted)] text-center py-4">لا توجد إعلانات منشورة حالياً</p>
          ) : (
            announcements.map((ann) => (
              <div key={ann.id} className="p-4 rounded-xl border border-[var(--color-border)] bg-white space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-[var(--color-text)]">{ann.title}</h4>
                  <span className="badge badge-success text-[10px]">نشط</span>
                </div>
                <p className="text-xs text-[var(--color-muted)]">{ann.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
