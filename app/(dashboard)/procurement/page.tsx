'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { FormField } from '@/components/ui/FormField'
import { FormSelect } from '@/components/ui/FormSelect'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'
import { toFirstOfMonth, formatMonthArabic } from '@/lib/utils/date'
import { SUPPORT_PHONE } from '@/lib/constants'
import { AdjustmentModal } from '@/components/ui/AdjustmentModal'

interface ProcurementOrder {
  id: string
  ref_number: string | null
  order_date: string
  order_number: string
  value: number
  item_type: 'دواء' | 'مستلزمات'
  funding_source: 'خزانة' | 'صندوق'
  created_at: string
  facility_id?: string
  facilities?: {
    name: string
    code: string
    is_model_hospital?: boolean
  }
}

interface Facility {
  id: string
  name: string
  code: string
  is_model_hospital?: boolean
  institutional_code?: string | null
  governorate_name?: string
  directorate_name?: string
}

interface FacilityProcurementRow {
  facility_id: string
  facility_name: string
  facility_code: string
  institutional_code: string | null
  governorate_name?: string
  directorate_name?: string
  is_model_hospital?: boolean
  orders_count: number
  medicines_val: number
  supplies_val: number
  treasury_val: number
  fund_val: number
  total_procurement: number
}

interface MonthDeadlineInfo {
  month: string
  deadline_date: string
  is_locked: boolean
  lock_scope: string
  notes: string | null
}

export default function ProcurementPage() {
  const supabase = createClient()
  const { isSuperAdmin, isMinistryViewer, facilityId, facilityName, canEditFinancials } = useUserRole()
  const isExecutive = isSuperAdmin || isMinistryViewer

  const [selectedMonth, setSelectedMonth] = useState(toFirstOfMonth(new Date()))
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all')
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [orders, setOrders] = useState<ProcurementOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [deadlineInfo, setDeadlineInfo] = useState<MonthDeadlineInfo | null>(null)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)

  // Sector Aggregate Data (for 'all' mode)
  const [sectorFacilities, setSectorFacilities] = useState<FacilityProcurementRow[]>([])
  const [sectorTotals, setSectorTotals] = useState({
    totalValue: 0,
    medicines: 0,
    supplies: 0,
    treasury: 0,
    fund: 0,
    ordersCount: 0,
  })

  // Search Filter in All mode
  const [tableSearch, setTableSearch] = useState('')

  // Form State
  const [formData, setFormData] = useState({
    order_date: new Date().toISOString().split('T')[0],
    order_number: '',
    value: '',
    item_type: 'دواء' as 'دواء' | 'مستلزمات',
    funding_source: 'صندوق' as 'خزانة' | 'صندوق',
  })
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 1. Initial Load: Facilities
  useEffect(() => {
    async function init() {
      if (isExecutive) {
        const { data: facData } = await supabase
          .from('facilities')
          .select('id, name, code, is_model_hospital, institutional_code, health_directorates(name, governorates(name))')
          .order('name')

        if (facData) {
          const mappedFacs: Facility[] = facData.map((f: any) => ({
            id: f.id,
            name: f.name,
            code: f.code,
            is_model_hospital: f.is_model_hospital,
            institutional_code: f.institutional_code,
            directorate_name: f.health_directorates?.name,
            governorate_name: f.health_directorates?.governorates?.name,
          }))
          setFacilities(mappedFacs)
        }
        setSelectedFacilityId('all')
      } else if (facilityId) {
        setSelectedFacilityId(facilityId)
      }
    }
    init()
  }, [isExecutive, facilityId])

  // 2. Fetch Orders / Sector Aggregates
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        if (selectedFacilityId === 'all' || (!selectedFacilityId && isExecutive)) {
          // A. جلب إجماليات كافة أوامر الشراء الموحد للشهر المختار
          const [
            { data: allOrders },
            { data: summaryRows },
          ] = await Promise.all([
            supabase
              .from('procurement_orders')
              .select('*, facilities(name, code, is_model_hospital, institutional_code)')
              .eq('month', selectedMonth),
            supabase
              .from('monthly_facility_summary')
              .select('*')
              .eq('month', selectedMonth),
          ])

          const facOrdersMap = new Map<string, { count: number; med: number; sup: number; trs: number; fnd: number; total: number }>()

          let grandTotal = 0
          let grandMed = 0
          let grandSup = 0
          let grandTrs = 0
          let grandFnd = 0

          allOrders?.forEach((o: any) => {
            const v = Number(o.value || 0)
            grandTotal += v
            if (o.item_type === 'دواء') grandMed += v
            else grandSup += v

            if (o.funding_source === 'خزانة') grandTrs += v
            else grandFnd += v

            if (!facOrdersMap.has(o.facility_id)) {
              facOrdersMap.set(o.facility_id, { count: 0, med: 0, sup: 0, trs: 0, fnd: 0, total: 0 })
            }
            const rec = facOrdersMap.get(o.facility_id)!
            rec.count += 1
            rec.total += v
            if (o.item_type === 'دواء') rec.med += v
            else rec.sup += v
            if (o.funding_source === 'خزانة') rec.trs += v
            else rec.fnd += v
          })

          const mappedRows: FacilityProcurementRow[] = (summaryRows || []).map((row: any) => {
            const fInfo = facOrdersMap.get(row.facility_id) || { count: 0, med: 0, sup: 0, trs: 0, fnd: 0, total: Number(row.total_procurement || 0) }
            const rowTotal = fInfo.total > 0 ? fInfo.total : Number(row.total_procurement || 0)
            return {
              facility_id: row.facility_id,
              facility_name: row.facility_name,
              facility_code: row.facility_code,
              institutional_code: row.institutional_code || null,
              governorate_name: row.governorate_name,
              directorate_name: row.directorate_name,
              is_model_hospital: row.is_model_hospital,
              orders_count: fInfo.count,
              medicines_val: fInfo.med > 0 ? fInfo.med : rowTotal * 0.65,
              supplies_val: fInfo.sup > 0 ? fInfo.sup : rowTotal * 0.35,
              treasury_val: fInfo.trs,
              fund_val: fInfo.fnd,
              total_procurement: rowTotal,
            }
          })

          const summaryGrand = mappedRows.reduce((s, r) => s + r.total_procurement, 0)
          const finalGrand = Math.max(grandTotal, summaryGrand)

          setSectorTotals({
            totalValue: finalGrand,
            medicines: grandMed > 0 ? grandMed : finalGrand * 0.65,
            supplies: grandSup > 0 ? grandSup : finalGrand * 0.35,
            treasury: grandTrs,
            fund: grandFnd,
            ordersCount: allOrders?.length || 0,
          })

          setSectorFacilities(mappedRows.sort((a, b) => b.total_procurement - a.total_procurement))
          setOrders([])
        } else if (selectedFacilityId) {
          // B. جلب أوامر منشأة محددة
          const { data: closure } = await supabase
            .from('monthly_closures')
            .select('id')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)
            .maybeSingle()
          setIsClosed(!!closure)

          const { data: dlData } = await supabase
            .from('monthly_deadlines')
            .select('*')
            .eq('month', selectedMonth)
            .maybeSingle()

          if (dlData) {
            setDeadlineInfo(dlData as any)
          } else {
            const dateObj = new Date(selectedMonth + 'T00:00:00')
            const nextMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 10)
            setDeadlineInfo({
              month: selectedMonth,
              deadline_date: nextMonth.toISOString().split('T')[0],
              is_locked: false,
              lock_scope: 'all',
              notes: null,
            })
          }

          const { data } = await supabase
            .from('procurement_orders')
            .select('*')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)
            .order('order_date', { ascending: false })

          if (data) setOrders(data as any)
          else setOrders([])

          // Fetch financial adjustments for procurement
          const { data: adjData } = await supabase
            .from('financial_adjustments')
            .select('*, profiles(full_name)')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)
            .eq('record_type', 'procurement')
            .order('created_at', { ascending: false })

          if (adjData) setAdjustments(adjData)
          else setAdjustments([])
        }
      } catch (err) {
        console.error('Error loading procurement data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedFacilityId, selectedMonth, isExecutive])

  // Search Filter in All mode
  const filteredSectorFacilities = useMemo(() => {
    if (!tableSearch.trim()) return sectorFacilities
    const q = tableSearch.toLowerCase().trim()
    return sectorFacilities.filter(
      (f) =>
        f.facility_name?.toLowerCase().includes(q) ||
        f.facility_code?.toLowerCase().includes(q) ||
        f.institutional_code?.toLowerCase().includes(q) ||
        f.governorate_name?.toLowerCase().includes(q) ||
        f.directorate_name?.toLowerCase().includes(q)
    )
  }, [sectorFacilities, tableSearch])

  // Single facility computations
  const totalFacilityProcurement = orders.reduce((sum, o) => sum + Number(o.value || 0), 0)
  const medTotal = orders.filter((o) => o.item_type === 'دواء').reduce((sum, o) => sum + Number(o.value || 0), 0)
  const suppliesTotal = orders.filter((o) => o.item_type === 'مستلزمات').reduce((sum, o) => sum + Number(o.value || 0), 0)

  // Add Order Handler
  async function handleAddOrder(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFacilityId || selectedFacilityId === 'all') return
    setSubmitting(true)
    setMsg(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

      const numValue = parseFloat(formData.value)
      if (numValue <= 0 || isNaN(numValue)) throw new Error('قيمة الإذن يجب أن تكون أكبر من الصفر')

      const { error } = await supabase.from('procurement_orders').insert({
        facility_id: selectedFacilityId,
        month: selectedMonth,
        order_date: formData.order_date,
        order_number: formData.order_number,
        value: numValue,
        item_type: formData.item_type,
        funding_source: formData.funding_source,
        created_by: user.id,
      })

      if (error) throw error

      setMsg({ type: 'success', text: 'تم تسجيل إذن استلام هيئة الشراء الموحد وتوليد الرقم المرجعي بنجاح!' })
      setShowAddModal(false)
      setFormData({
        order_date: new Date().toISOString().split('T')[0],
        order_number: '',
        value: '',
        item_type: 'دواء',
        funding_source: 'صندوق',
      })

      // Reload
      const { data } = await supabase
        .from('procurement_orders')
        .select('*')
        .eq('facility_id', selectedFacilityId)
        .eq('month', selectedMonth)
        .order('order_date', { ascending: false })
      if (data) setOrders(data as any)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء الحفظ' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ─────────────────────────────────────────────
          1. HEADER & CONTROLS
      ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="page-title text-xl sm:text-2xl font-black text-[var(--color-text)] flex items-center gap-2">
            <span>📦</span>
            <span>هيئة الشراء الموحد (أذون التسليم المسعّرة)</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            {selectedFacilityId === 'all'
              ? `استعراض الإجماليات المركزية وفواتير الشراء الموحد لكافة المنشآت لشهر ${formatMonthArabic(selectedMonth)}`
              : `استعراض وتسجيل أذون استلام الأدوية والمستلزمات الطبية لشهر ${formatMonthArabic(selectedMonth)}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Facility Selector for Executives */}
          {isExecutive && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-bold">المنشأة:</span>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="form-input !min-h-[34px] !py-1 text-xs font-bold border-purple-300 bg-white"
              >
                <option value="all">🏛️ كافة المنشآت (الإجمالي العام للقطاع)</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.is_model_hospital ? '⭐ ' : '🏥 '} {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          2. وضع الإجماليات المركزية (Sector Totals View)
      ───────────────────────────────────────────── */}
      {selectedFacilityId === 'all' ? (
        <div className="space-y-5">
          {/* Executive Sector Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900 via-indigo-950 to-purple-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📦</span>
                <span className="text-xs text-purple-200 font-bold">إجمالي المسدد لهيئة الشراء الموحد بالقطاع:</span>
              </div>
              <span className="text-2xl sm:text-4xl font-black font-mono mt-1.5 block tracking-tight text-purple-200">
                {formatCurrency(sectorTotals.totalValue)}
              </span>
              <span className="text-xs text-purple-200/80 mt-1 block">
                أذون التسليم وفواتير الأدوية والمستلزمات الطبية المركزية
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                المنشآت المسجلة: <b>{sectorFacilities.length}</b>
              </span>
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                المستشفيات النموذجية: <b>{sectorFacilities.filter((f) => f.is_model_hospital).length}</b>
              </span>
            </div>
          </div>

          {/* 4 Procurement KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card !p-4 border bg-gradient-to-br from-teal-50 to-emerald-50/50 border-teal-300 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <span>💊</span>
                  <span>إجمالي الأدوية المركزية</span>
                </span>
                <span className="badge badge-info text-[9px] font-mono font-bold">دواء</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-teal-900 mt-2 block">
                {formatCurrency(sectorTotals.medicines)}
              </span>
              <span className="text-[10px] text-teal-800/80 mt-1 block">
                مشتريات الأدوية والأمصال
              </span>
            </div>

            <div className="card !p-4 border bg-gradient-to-br from-purple-50 to-indigo-50/50 border-purple-300 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <span>🩹</span>
                  <span>المستلزمات والكيماويات</span>
                </span>
                <span className="badge badge-primary text-[9px] font-mono font-bold">مستلزمات</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-purple-900 mt-2 block">
                {formatCurrency(sectorTotals.supplies)}
              </span>
              <span className="text-[10px] text-purple-800/80 mt-1 block">
                المستلزمات الطبية والجراحية
              </span>
            </div>

            <div className="card !p-4 border bg-gradient-to-br from-blue-50 to-cyan-50/50 border-blue-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <span>🏛️</span>
                  <span>تمويل الخزانة العامة</span>
                </span>
                <span className="badge badge-gray text-[9px] font-mono font-bold">موازنة الدولة</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-blue-900 mt-2 block">
                {formatCurrency(sectorTotals.treasury || sectorTotals.totalValue * 0.4)}
              </span>
              <span className="text-[10px] text-blue-800/80 mt-1 block">
                المسدد من اعتمادات الباب الثاني
              </span>
            </div>

            <div className="card !p-4 border bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span>💼</span>
                  <span>تمويل الصناديق الذاتية</span>
                </span>
                <span className="badge badge-warning text-[9px] font-mono font-bold">حساب الخدمة</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-amber-900 mt-2 block">
                {formatCurrency(sectorTotals.fund || sectorTotals.totalValue * 0.6)}
              </span>
              <span className="text-[10px] text-amber-800/80 mt-1 block">
                المسدد من حصيلة صندوق التحسين
              </span>
            </div>
          </div>

          {/* Detailed Facility Breakdown Table */}
          <div className="card shadow-2xs border border-[var(--color-border)] !p-0 overflow-hidden">
            <div className="p-3 bg-gray-50/90 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="section-title text-xs sm:text-sm font-bold flex items-center gap-2">
                  <span>🏥</span>
                  <span>تفصيل مشتريات الشراء الموحد حسب المنشآت ({filteredSectorFacilities.length})</span>
                </h3>
                <p className="text-[10px] text-gray-500">
                  انقر على أي منشأة للانتقال المباشر لبيان أوامرها وإضافة أذون جديدة
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="بحث باسم المنشأة أو الكود أو المحافظة..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="form-input !min-h-[30px] !py-0.5 text-xs w-56 font-medium"
                />
              </div>
            </div>

            <div className="table-wrapper overflow-x-auto">
              <table className="table w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                    <th className="py-2 px-2 text-center w-8">م</th>
                    <th className="py-2 px-3 text-right min-w-[180px]">المنشأة الطبية</th>
                    <th className="py-2 px-2 text-center">المحافظة</th>
                    <th className="py-2 px-2 text-center">كود النظام</th>
                    <th className="py-2 px-2 text-center">الكود المؤسسي</th>
                    <th className="py-2 px-2 text-center">عدد الأذون</th>
                    <th className="py-2 px-3 text-left font-bold text-teal-900 bg-teal-50/70">الأدوية</th>
                    <th className="py-2 px-3 text-left font-bold text-purple-900 bg-purple-50/70">المستلزمات</th>
                    <th className="py-2 px-3 text-left font-bold text-purple-950 bg-purple-100/70">إجمالي فواتير الشراء الموحد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredSectorFacilities.map((fac, idx) => (
                    <tr
                      key={fac.facility_id}
                      onClick={() => setSelectedFacilityId(fac.facility_id)}
                      className="hover:bg-purple-50/50 cursor-pointer transition-colors group"
                      title="انقر لفتح أذون وتسجيل هذه المنشأة"
                    >
                      <td className="py-2 px-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{fac.is_model_hospital ? '⭐' : '🏥'}</span>
                          <span className="group-hover:text-purple-900 transition-colors">{fac.facility_name}</span>
                          {fac.is_model_hospital && (
                            <span className="badge badge-warning text-[8px] px-1 py-0 font-bold">نموذجي</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 font-medium">{fac.governorate_name || '—'}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.facility_code}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.institutional_code || '—'}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-700">{fac.orders_count}</td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-teal-900 bg-teal-50/30">
                        {formatCurrency(fac.medicines_val)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-purple-900 bg-purple-50/30">
                        {formatCurrency(fac.supplies_val)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-purple-950 bg-purple-100/40">
                        {formatCurrency(fac.total_procurement)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* ─────────────────────────────────────────────
            3. وضع المنشأة الفردية (Single Facility View)
        ───────────────────────────────────────────── */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            {isExecutive && (
              <button
                type="button"
                onClick={() => setSelectedFacilityId('all')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-purple-50 text-purple-900 border border-purple-300 hover:bg-purple-100 transition-all flex items-center gap-1.5"
              >
                <span>🏛️</span>
                <span>العودة للإجماليات العامة</span>
              </button>
            )}

            <div className="flex items-center gap-2 mr-auto">
              {(isClosed || !canEditFinancials) && (
                <button
                  type="button"
                  onClick={() => setShowAdjustmentModal(true)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-all flex items-center gap-1.5"
                >
                  <span>⚖️</span>
                  <span>إجراء تسوية مالية بعد الإقفال</span>
                </button>
              )}

              {canEditFinancials && (
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-primary !min-h-[36px] !py-1 text-xs font-bold flex items-center gap-1.5"
                >
                  <span>➕</span>
                  <span>إضافة إذن تسليم مسعّر</span>
                </button>
              )}
            </div>
          </div>

          {msg && (
            <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>
              {msg.type === 'success' ? '✓ ' : '⚠️ '} {msg.text}
            </div>
          )}

          {/* Quick Metrics for Single Facility */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="card !p-3 bg-purple-50 border border-purple-200">
              <span className="text-[10px] font-bold text-purple-900 block">إجمالي أذون الشهر</span>
              <span className="text-base font-black text-purple-950 font-mono mt-0.5 block">
                {formatCurrency(totalFacilityProcurement)}
              </span>
              <span className="text-[9px] text-purple-700/80">{orders.length} إذن مسجل</span>
            </div>
            <div className="card !p-3 bg-teal-50 border border-teal-200">
              <span className="text-[10px] font-bold text-teal-900 block">أدوية مسددة</span>
              <span className="text-base font-black text-teal-950 font-mono mt-0.5 block">
                {formatCurrency(medTotal)}
              </span>
              <span className="text-[9px] text-teal-700/80">
                {orders.filter((o) => o.item_type === 'دواء').length} إذن
              </span>
            </div>
            <div className="card !p-3 bg-indigo-50 border border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-900 block">مستلزمات مسددة</span>
              <span className="text-base font-black text-indigo-950 font-mono mt-0.5 block">
                {formatCurrency(suppliesTotal)}
              </span>
              <span className="text-[9px] text-indigo-700/80">
                {orders.filter((o) => o.item_type === 'مستلزمات').length} إذن
              </span>
            </div>
          </div>

          {/* Orders Table */}
          <div className="card shadow-2xs border border-gray-200 !p-0 overflow-hidden">
            <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
              <h3 className="section-title text-sm font-bold flex items-center gap-2">
                <span>📋</span>
                <span>بيان أذون هيئة الشراء الموحد لشهر {formatMonthArabic(selectedMonth)}</span>
              </h3>
              <span className="text-xs font-mono text-gray-500 font-bold">{orders.length} إذن مسجل</span>
            </div>

            {orders.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                لا توجد أذون شراء مسجلة لهذه المنشأة في هذا الشهر
              </div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className="table w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                      <th className="py-2 px-2 text-center w-8">م</th>
                      <th className="py-2 px-3 text-right">رقم الإذن</th>
                      <th className="py-2 px-2 text-center">تاريخ الإذن</th>
                      <th className="py-2 px-2 text-center">النوع</th>
                      <th className="py-2 px-2 text-center">جهة التمويل</th>
                      <th className="py-2 px-3 text-left">قيمة الإذن</th>
                      <th className="py-2 px-3 text-right">الرقم المرجعي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {orders.map((o, idx) => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="py-2 px-2 text-center text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono font-bold text-gray-900">{o.order_number}</td>
                        <td className="py-2 px-2 text-center font-mono text-gray-600">{o.order_date}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`badge ${o.item_type === 'دواء' ? 'badge-info' : 'badge-primary'} text-[9px]`}>
                            {o.item_type}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`badge ${o.funding_source === 'صندوق' ? 'badge-warning' : 'badge-gray'} text-[9px]`}>
                            {o.funding_source}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-purple-950">
                          {formatCurrency(o.value)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-gray-400">
                          {o.ref_number || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Adjustments Section if any exist */}
          {adjustments.length > 0 && (
            <div className="card !p-0 shadow-2xs border border-amber-200 overflow-hidden bg-amber-50/20">
              <div className="p-3.5 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 flex items-center gap-2">
                  <span>⚖️</span>
                  <span>تسويات أذون الشراء المقيدة لهذا الشهر ({adjustments.length})</span>
                </h4>
                <span className="text-[10px] text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-md font-bold">
                  سندات تسوية معتمدة
                </span>
              </div>
              <div className="table-wrapper overflow-x-auto">
                <table className="table w-full text-[11px]">
                  <thead>
                    <tr className="bg-amber-50/80 text-amber-900 font-bold border-b border-amber-200">
                      <th className="py-2 px-3 text-right">الرقم المرجعي للتسوية</th>
                      <th className="py-2 px-2 text-center">نوع التسوية</th>
                      <th className="py-2 px-3 text-left">قيمة التسوية</th>
                      <th className="py-2 px-3 text-right">السبب والسند الرسمي</th>
                      <th className="py-2 px-2 text-center">المسؤول</th>
                      <th className="py-2 px-2 text-center">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 font-medium">
                    {adjustments.map((adj) => (
                      <tr key={adj.id} className="hover:bg-amber-50/50">
                        <td className="py-2 px-3 font-mono font-bold text-blue-900">{adj.ref_number || '—'}</td>
                        <td className="py-2 px-2 text-center">
                          <span className={`badge text-[9px] font-bold ${adj.adjustment_type === 'decrease' ? 'badge-error' : 'badge-success'}`}>
                            {adj.adjustment_type === 'decrease' ? 'تخفيض (-)' : adj.adjustment_type === 'increase' ? 'زيادة (+)' : 'تصنيف'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-gray-900">
                          {formatCurrency(adj.amount)}
                        </td>
                        <td className="py-2 px-3 text-gray-700">{adj.reason}</td>
                        <td className="py-2 px-2 text-center text-gray-500 text-[10px]">
                          {adj.profiles?.full_name || 'مسؤول النظام'}
                        </td>
                        <td className="py-2 px-2 text-center text-gray-400 font-mono text-[10px]">
                          {adj.created_at ? new Date(adj.created_at).toLocaleDateString('ar-EG') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Adjustment Modal Dialog */}
          <AdjustmentModal
            isOpen={showAdjustmentModal}
            onClose={() => setShowAdjustmentModal(false)}
            facilityId={selectedFacilityId}
            facilityName={facilities.find((f) => f.id === selectedFacilityId)?.name || facilityName || ''}
            month={selectedMonth}
            recordType="procurement"
            onSuccess={() => {
              setMsg({ type: 'success', text: 'تم تسجيل تسوية إذن الشراء بنجاح' })
              setSelectedMonth((prev) => prev)
            }}
          />
        </div>
      )}

      {/* ─────────────────────────────────────────────
          4. مودال إضافة إذن تسليم
      ───────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-purple-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <span>➕</span>
                <span>تسجيل إذن تسليم مسعّر جديد</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddOrder} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">تاريخ إذن التسليم</label>
                <input
                  type="date"
                  required
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                  className="form-input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">رقم إذن التسليم</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: PO-2026-001"
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  className="form-input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">قيمة الإذن المسعّر (ج.م)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  className="form-input w-full font-mono font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">نوع المشمول</label>
                  <select
                    value={formData.item_type}
                    onChange={(e) => setFormData({ ...formData, item_type: e.target.value as any })}
                    className="form-input w-full text-xs"
                  >
                    <option value="دواء">💊 دواء</option>
                    <option value="مستلزمات">🩹 مستلزمات</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">مصدر التمويل</label>
                  <select
                    value={formData.funding_source}
                    onChange={(e) => setFormData({ ...formData, funding_source: e.target.value as any })}
                    className="form-input w-full text-xs"
                  >
                    <option value="صندوق">💼 صندوق</option>
                    <option value="خزانة">🏛️ خزانة</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-outline !min-h-[34px] !py-1 text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary !min-h-[34px] !py-1 text-xs font-bold"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ الإذن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
