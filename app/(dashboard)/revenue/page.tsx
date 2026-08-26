'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'
import { toFirstOfMonth, formatMonthArabic, getFiscalYear, parseMonthDate, getFiscalQuarter } from '@/lib/utils/date'
import { SUPPORT_PHONE } from '@/lib/constants'
import { AdjustmentModal } from '@/components/ui/AdjustmentModal'

interface RevenueSource {
  id: string
  label: string
  display_order: number
}

interface RevenueEntry {
  id: string
  revenue_source_id: string
  amount: number
  notes: string | null
  ref_number: string | null
  created_at?: string
  revenue_sources?: {
    label: string
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

interface FacilitySummaryRow {
  facility_id: string
  facility_name: string
  facility_code: string
  institutional_code: string | null
  governorate_name?: string
  directorate_name?: string
  is_model_hospital?: boolean
  total_revenue: number
  sourcesMap: Record<string, number>
}

interface MonthDeadlineInfo {
  month: string
  deadline_date: string
  is_locked: boolean
  lock_scope: string
  notes: string | null
}

interface FiscalRevenueMonthRecord {
  month: string
  monthLabel: string
  quarter: number
  totalRevenue: number
  sourcesBreakdown: Record<string, number>
  entriesCount: number
  isClosed: boolean
}

interface HistoricalMonthRecord {
  month: string
  monthLabel: string
  totalRevenue: number
  entriesCount: number
  isClosed: boolean
}

export default function RevenuePage() {
  const supabase = createClient()
  const { isSuperAdmin, isMinistryViewer, facilityId, facilityName, canEditFinancials } = useUserRole()
  const isExecutive = isSuperAdmin || isMinistryViewer

  const [activeTab, setActiveTab] = useState<'current' | 'quarterly' | 'annual' | 'history'>('current')
  const [selectedMonth, setSelectedMonth] = useState(toFirstOfMonth(new Date()))
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all')
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [sources, setSources] = useState<RevenueSource[]>([])
  const [entries, setEntries] = useState<RevenueEntry[]>([])
  const [amounts, setAmounts] = useState<Record<string, { amount: string; notes: string }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [deadlineInfo, setDeadlineInfo] = useState<MonthDeadlineInfo | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Sector Aggregate Data (for 'all' mode)
  const [sectorFacilitiesSummary, setSectorFacilitiesSummary] = useState<FacilitySummaryRow[]>([])
  const [sectorTotalRevenue, setSectorTotalRevenue] = useState(0)
  const [sectorSourcesTotals, setSectorSourcesTotals] = useState<Record<string, number>>({})

  // Search & Filter in All mode
  const [tableSearch, setTableSearch] = useState('')

  // Historical & Fiscal Data
  const [fiscalYearData, setFiscalYearData] = useState<FiscalRevenueMonthRecord[]>([])
  const [historyData, setHistoryData] = useState<HistoricalMonthRecord[]>([])
  const [loadingFiscal, setLoadingFiscal] = useState(false)

  // Financial Adjustments
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)

  // Reopening Support Modal & Super Admin Mode
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [superAdminEditMode, setSuperAdminEditMode] = useState(false)

  // 1. Initial Data: Sources & Facilities
  useEffect(() => {
    async function init() {
      const { data: srcData } = await supabase
        .from('revenue_sources')
        .select('*')
        .order('display_order')

      if (srcData) setSources(srcData)

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

  // 2. Fetch Selected Month Data (Either Sector All or Single Facility)
  useEffect(() => {
    async function loadMonthData() {
      setLoading(true)
      setMsg(null)

      try {
        if (selectedFacilityId === 'all' || (!selectedFacilityId && isExecutive)) {
          // A. جلب الإجماليات من monthly_facility_summary و revenue_entries
          const [
            { data: summaryRows },
            { data: revEntriesResult },
          ] = await Promise.all([
            supabase
              .from('monthly_facility_summary')
              .select('*')
              .eq('month', selectedMonth),
            supabase
              .from('revenue_entries')
              .select('facility_id, revenue_source_id, amount')
              .eq('month', selectedMonth),
          ])

          const srcSumMap: Record<string, number> = {}
          let grandTotal = 0
          const facSourcesMap = new Map<string, Record<string, number>>()

          revEntriesResult?.forEach((e: any) => {
            const amt = Number(e.amount || 0)
            grandTotal += amt
            srcSumMap[e.revenue_source_id] = (srcSumMap[e.revenue_source_id] || 0) + amt

            if (!facSourcesMap.has(e.facility_id)) {
              facSourcesMap.set(e.facility_id, {})
            }
            const fMap = facSourcesMap.get(e.facility_id)!
            fMap[e.revenue_source_id] = (fMap[e.revenue_source_id] || 0) + amt
          })

          const mappedSummaryRows: FacilitySummaryRow[] = (summaryRows || []).map((row: any) => ({
            facility_id: row.facility_id,
            facility_name: row.facility_name,
            facility_code: row.facility_code,
            institutional_code: row.institutional_code || null,
            governorate_name: row.governorate_name,
            directorate_name: row.directorate_name,
            is_model_hospital: row.is_model_hospital,
            total_revenue: Number(row.total_revenue || 0),
            sourcesMap: facSourcesMap.get(row.facility_id) || {},
          }))

          // If summaryRows has sum greater than grandTotal, use it
          const summaryGrandTotal = mappedSummaryRows.reduce((s, r) => s + r.total_revenue, 0)
          setSectorTotalRevenue(Math.max(grandTotal, summaryGrandTotal))
          setSectorSourcesTotals(srcSumMap)
          setSectorFacilitiesSummary(
            mappedSummaryRows.sort((a, b) => b.total_revenue - a.total_revenue)
          )
          setEntries([])
          setAmounts({})
        } else if (selectedFacilityId) {
          // B. جلب بيانات منشأة محددة
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
            const defaultDeadline = nextMonth.toISOString().split('T')[0]
            setDeadlineInfo({
              month: selectedMonth,
              deadline_date: defaultDeadline,
              is_locked: false,
              lock_scope: 'all',
              notes: null,
            })
          }

          const { data: revEntries } = await supabase
            .from('revenue_entries')
            .select('*, revenue_sources(label)')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)

          if (revEntries) {
            setEntries(revEntries as any)
            const newAmounts: Record<string, { amount: string; notes: string }> = {}
            revEntries.forEach((e) => {
              newAmounts[e.revenue_source_id] = {
                amount: String(e.amount),
                notes: e.notes || '',
              }
            })
            setAmounts(newAmounts)
          } else {
            setEntries([])
            setAmounts({})
          }

          // Fetch financial adjustments for closed month correction
          const { data: adjData } = await supabase
            .from('financial_adjustments')
            .select('*, profiles(full_name)')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)
            .eq('record_type', 'revenue')
            .order('created_at', { ascending: false })

          if (adjData) {
            setAdjustments(adjData)
          } else {
            setAdjustments([])
          }
        }
      } catch (err) {
        console.error('Error loading revenue data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMonthData()
  }, [selectedFacilityId, selectedMonth, isExecutive])

  // 3. Single Facility Fiscal & History
  useEffect(() => {
    async function loadFiscalAndHistory() {
      if (!selectedFacilityId || selectedFacilityId === 'all') return
      setLoadingFiscal(true)
      try {
        const currentDate = parseMonthDate(selectedMonth)
        const fiscalYear = getFiscalYear(currentDate)

        const monthsList: string[] = []
        for (let m = 7; m <= 12; m++) {
          monthsList.push(`${fiscalYear}-${String(m).padStart(2, '0')}-01`)
        }
        for (let m = 1; m <= 6; m++) {
          monthsList.push(`${fiscalYear + 1}-${String(m).padStart(2, '0')}-01`)
        }

        const { data: allYearEntries } = await supabase
          .from('revenue_entries')
          .select('month, revenue_source_id, amount')
          .eq('facility_id', selectedFacilityId)
          .in('month', monthsList)

        const { data: allFacilityEntries } = await supabase
          .from('revenue_entries')
          .select('month, amount')
          .eq('facility_id', selectedFacilityId)
          .order('month', { ascending: false })

        const { data: closures } = await supabase
          .from('monthly_closures')
          .select('month')
          .eq('facility_id', selectedFacilityId)

        const closedSet = new Set(closures?.map((c) => c.month) || [])

        const fiscalRecords: FiscalRevenueMonthRecord[] = monthsList.map((mStr) => {
          const mEntries = allYearEntries?.filter((e) => e.month === mStr) || []
          const totalRev = mEntries.reduce((s, e) => s + Number(e.amount), 0)
          const breakdown: Record<string, number> = {}
          mEntries.forEach((e) => {
            breakdown[e.revenue_source_id] = Number(e.amount)
          })

          return {
            month: mStr,
            monthLabel: formatMonthArabic(mStr),
            quarter: getFiscalQuarter(parseMonthDate(mStr)),
            totalRevenue: totalRev,
            sourcesBreakdown: breakdown,
            entriesCount: mEntries.length,
            isClosed: closedSet.has(mStr),
          }
        })
        setFiscalYearData(fiscalRecords)

        const monthGroupMap: Record<string, { total: number; count: number }> = {}
        allFacilityEntries?.forEach((e) => {
          if (!monthGroupMap[e.month]) {
            monthGroupMap[e.month] = { total: 0, count: 0 }
          }
          monthGroupMap[e.month].total += Number(e.amount)
          monthGroupMap[e.month].count += 1
        })

        const historyList: HistoricalMonthRecord[] = Object.keys(monthGroupMap)
          .sort((a, b) => b.localeCompare(a))
          .map((mStr) => ({
            month: mStr,
            monthLabel: formatMonthArabic(mStr),
            totalRevenue: monthGroupMap[mStr].total,
            entriesCount: monthGroupMap[mStr].count,
            isClosed: closedSet.has(mStr),
          }))

        setHistoryData(historyList)
      } catch (err) {
        console.error('Error loading fiscal revenue:', err)
      } finally {
        setLoadingFiscal(false)
      }
    }

    loadFiscalAndHistory()
  }, [selectedFacilityId, selectedMonth])

  // Filters in All mode
  const filteredSectorFacilities = useMemo(() => {
    if (!tableSearch.trim()) return sectorFacilitiesSummary
    const q = tableSearch.toLowerCase().trim()
    return sectorFacilitiesSummary.filter(
      (f) =>
        f.facility_name?.toLowerCase().includes(q) ||
        f.facility_code?.toLowerCase().includes(q) ||
        f.institutional_code?.toLowerCase().includes(q) ||
        f.governorate_name?.toLowerCase().includes(q) ||
        f.directorate_name?.toLowerCase().includes(q)
    )
  }, [sectorFacilitiesSummary, tableSearch])

  // Check deadline
  const todayStr = new Date().toISOString().split('T')[0]
  const isPastDeadline = deadlineInfo?.deadline_date ? todayStr > deadlineInfo.deadline_date : false
  const isLockedByMinistry = !!deadlineInfo?.is_locked
  const lockScope = deadlineInfo?.lock_scope || 'all'
  const isScopeLocked = lockScope === 'all' || lockScope === 'revenue'
  const isMonthLockedForEntry = isClosed || ((isPastDeadline || isLockedByMinistry) && isScopeLocked)

  const totalAmount = Object.values(amounts).reduce((sum, item) => {
    const val = parseFloat(item.amount || '0')
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  // Save entries for a single facility
  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFacilityId || selectedFacilityId === 'all') return

    if (isMonthLockedForEntry && !isSuperAdmin) {
      setShowSupportModal(true)
      return
    }

    setSaving(true)
    setMsg(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

      for (const source of sources) {
        const item = amounts[source.id]
        const numAmount = parseFloat(item?.amount || '0')

        if (numAmount >= 0 && item?.amount !== undefined && item.amount !== '') {
          const { error } = await supabase.from('revenue_entries').upsert(
            {
              facility_id: selectedFacilityId,
              revenue_source_id: source.id,
              month: selectedMonth,
              amount: numAmount,
              notes: item.notes || null,
              created_by: user.id,
            },
            { onConflict: 'facility_id,revenue_source_id,month' }
          )

          if (error) throw error
        }
      }

      setMsg({ type: 'success', text: 'تم حفظ وتحديث كافة بنود الإيرادات بنجاح وتوليد الأرقام المرجعية!' })

      const { data: reloaded } = await supabase
        .from('revenue_entries')
        .select('*, revenue_sources(label)')
        .eq('facility_id', selectedFacilityId)
        .eq('month', selectedMonth)

      if (reloaded) setEntries(reloaded as any)
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء الحفظ' })
    } finally {
      setSaving(false)
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
            <span>💰</span>
            <span>الإيرادات</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            {selectedFacilityId === 'all'
              ? `استعراض الإجماليات المركزية ومصادر الإيرادات الـ 8 لشهر ${formatMonthArabic(selectedMonth)}`
              : `استعراض وتسجيل الإيرادات الذاتية لشهر ${formatMonthArabic(selectedMonth)}`}
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
                className="form-input !min-h-[34px] !py-1 text-xs font-bold border-blue-300 bg-white"
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
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🏛️</span>
                <span className="text-xs text-blue-200 font-bold">إجمالي الإيرادات الذاتية المحققة بالقطاع:</span>
              </div>
              <span className="text-2xl sm:text-4xl font-black font-mono mt-1.5 block tracking-tight">
                {formatCurrency(sectorTotalRevenue)}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                المنشآت المسجلة: <b>{sectorFacilitiesSummary.length}</b>
              </span>
              <span className="bg-amber-500/20 text-amber-200 px-3 py-1.5 rounded-xl border border-amber-400/30">
                المستشفيات النموذجية: <b>{sectorFacilitiesSummary.filter((f) => f.is_model_hospital).length}</b>
              </span>
            </div>
          </div>

          {/* 8 Source KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {sources.map((src, idx) => {
              const val = sectorSourcesTotals[src.id] || 0
              const pct = sectorTotalRevenue > 0 ? ((val / sectorTotalRevenue) * 100).toFixed(1) : '0'
              const colorSchemes = [
                'bg-blue-50/80 border-blue-200 text-blue-950',
                'bg-cyan-50/80 border-cyan-200 text-cyan-950',
                'bg-teal-50/80 border-teal-200 text-teal-950',
                'bg-emerald-50/80 border-emerald-200 text-emerald-950',
                'bg-indigo-50/80 border-indigo-200 text-indigo-950',
                'bg-violet-50/80 border-violet-200 text-violet-950',
                'bg-purple-50/80 border-purple-200 text-purple-950',
                'bg-amber-50/80 border-amber-200 text-amber-950',
              ][idx % 8]

              const icons = ['💰', '📄', '👥', '🎁', '🏛️', '🏥', '🛡️', '📦']

              return (
                <div key={src.id} className={`card !p-3 border ${colorSchemes} flex flex-col justify-between shadow-2xs`}>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs">{icons[idx % 8]}</span>
                      <span className="text-[10px] font-bold text-gray-800 truncate">{src.label}</span>
                    </div>
                    <span className="text-xs sm:text-sm font-black font-mono mt-1.5 block truncate">
                      {formatCurrencyShort(val)}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-gray-500 mt-1 block">{pct}% من الإجمالي</span>
                </div>
              )
            })}
          </div>

          {/* Detailed Facility Breakdown Table */}
          <div className="card shadow-2xs border border-[var(--color-border)] !p-0 overflow-hidden">
            <div className="p-3 bg-gray-50/90 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="section-title text-xs sm:text-sm font-bold flex items-center gap-2">
                  <span>🏥</span>
                  <span>تفصيل الإيرادات المحققة حسب المستشفيات والمنشآت ({filteredSectorFacilities.length})</span>
                </h3>
                <p className="text-[10px] text-gray-500">
                  انقر على أي منشأة للانتقال المباشر لاستمارة تسجيلها وتعديل بنودها
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
                    {sources.map((src) => (
                      <th key={src.id} className="py-2 px-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                        {src.label}
                      </th>
                    ))}
                    <th className="py-2 px-3 text-left font-bold text-blue-900 bg-blue-50/70 whitespace-nowrap">إجمالي الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredSectorFacilities.map((fac, idx) => (
                    <tr
                      key={fac.facility_id}
                      onClick={() => setSelectedFacilityId(fac.facility_id)}
                      className="hover:bg-blue-50/60 cursor-pointer transition-colors group"
                      title="انقر لفتح نموذج تسجيل وتعديل هذه المنشأة"
                    >
                      <td className="py-2 px-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{fac.is_model_hospital ? '⭐' : '🏥'}</span>
                          <span className="group-hover:text-blue-900 transition-colors">{fac.facility_name}</span>
                          {fac.is_model_hospital && (
                            <span className="badge badge-warning text-[8px] px-1 py-0 font-bold">نموذجي</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 font-medium">{fac.governorate_name || '—'}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.facility_code}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.institutional_code || '—'}</td>
                      {sources.map((src) => {
                        const val = fac.sourcesMap[src.id] || 0
                        return (
                          <td key={src.id} className="py-2 px-2 text-left font-mono text-gray-800">
                            {val > 0 ? formatCurrency(val) : '—'}
                          </td>
                        )
                      })}
                      <td className="py-2 px-3 text-left font-mono font-bold text-blue-950 bg-blue-50/40">
                        {formatCurrency(fac.total_revenue)}
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
          {/* Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('current')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'current'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>📅</span>
              <span>تسجيل واستعراض الشهر المختار</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>📜</span>
              <span>سجل كافة الشهور ({historyData.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quarterly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'quarterly'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>📊</span>
              <span>التقرير الربع سنوي (Q1 - Q4)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('annual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'annual'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>📆</span>
              <span>التقرير السنوي الشامل</span>
            </button>

            {isExecutive && (
              <button
                type="button"
                onClick={() => setSelectedFacilityId('all')}
                className="mr-auto px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-200 hover:bg-indigo-100 transition-all flex items-center gap-1.5"
              >
                <span>🏛️</span>
                <span>العودة للإجماليات العامة</span>
              </button>
            )}
          </div>

          {msg && (
            <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>
              {msg.type === 'success' ? '✓ ' : '⚠️ '} {msg.text}
            </div>
          )}

          {/* Form for Single Facility */}
          <form onSubmit={handleSaveAll} className="space-y-5">
            <div className="card !p-0 shadow-2xs border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="section-title text-sm sm:text-base font-bold">
                    استمارة قيد الإيرادات الذاتية لشهر {formatMonthArabic(selectedMonth)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    إدخال وتدقيق مبالغ المصادر الـ 8 مع الأرقام المرجعية والملاحظات
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 font-bold">إجمالي الشهر:</span>
                  <span className="text-base sm:text-lg font-black font-mono text-[var(--color-primary)]">
                    {formatCurrency(totalAmount)}
                  </span>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sources.map((source) => {
                    const item = amounts[source.id] || { amount: '', notes: '' }
                    return (
                      <div
                        key={source.id}
                        className="p-3.5 rounded-2xl border border-gray-200 bg-white hover:border-blue-300 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-800">
                            {source.display_order}. {source.label}
                          </label>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {formatCurrency(parseFloat(item.amount || '0'))}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={item.amount}
                              disabled={!canEditFinancials && !superAdminEditMode}
                              onChange={(e) =>
                                setAmounts({
                                  ...amounts,
                                  [source.id]: { ...item, amount: e.target.value },
                                })
                              }
                              className="form-input !min-h-[36px] !py-1 text-xs font-mono font-bold w-full"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              placeholder="ملاحظات..."
                              value={item.notes}
                              disabled={!canEditFinancials && !superAdminEditMode}
                              onChange={(e) =>
                                setAmounts({
                                  ...amounts,
                                  [source.id]: { ...item, notes: e.target.value },
                                })
                              }
                              className="form-input !min-h-[36px] !py-1 text-xs w-full"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between pt-3 border-t border-gray-100 gap-3">
                  <div className="flex items-center gap-2">
                    {(isClosed || !canEditFinancials) && (
                      <button
                        type="button"
                        onClick={() => setShowAdjustmentModal(true)}
                        className="px-4 py-2 text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 rounded-xl hover:bg-amber-100 shadow-2xs transition flex items-center gap-1.5"
                      >
                        <span>⚖️</span>
                        <span>إجراء تسوية مالية رسمية لشهر مقفل</span>
                      </button>
                    )}
                  </div>

                  {canEditFinancials && (
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="btn btn-primary !min-h-[38px] !px-6 text-xs font-bold shadow-md"
                      >
                        {saving ? 'جاري الحفظ...' : '💾 حفظ وتثبيت إيرادات الشهر'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          {/* Adjustments Section if any exist */}
          {adjustments.length > 0 && (
            <div className="card !p-0 shadow-2xs border border-amber-200 overflow-hidden bg-amber-50/20">
              <div className="p-3.5 bg-amber-100/60 border-b border-amber-200 flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 flex items-center gap-2">
                  <span>⚖️</span>
                  <span>سجلات التسويات المالية المقيدة لهذا الشهر ({adjustments.length})</span>
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
            recordType="revenue"
            onSuccess={() => {
              setMsg({ type: 'success', text: 'تم تقييد وترحيل التسوية المالية بنجاح' })
              // reload month data
              const reloadEvent = new CustomEvent('reload-revenue-month')
              window.dispatchEvent(reloadEvent)
              setTimeout(() => {
                setSelectedMonth((prev) => prev)
              }, 100)
            }}
          />
        </div>
      )}
    </div>
  )
}
