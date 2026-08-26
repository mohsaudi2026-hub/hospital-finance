'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'
import { toFirstOfMonth, formatMonthArabic, getFiscalYear, parseMonthDate, getFiscalQuarter } from '@/lib/utils/date'
import { DEDUCTION_TYPES, DEDUCTION_TYPE_LABELS, SUPPORT_PHONE, type DeductionType } from '@/lib/constants'
import { AdjustmentModal } from '@/components/ui/AdjustmentModal'

interface DeductionEntry {
  id: string
  deduction_type: DeductionType
  amount: number
  notes: string | null
  ref_number: string | null
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

interface FacilityDeductionRow {
  facility_id: string
  facility_name: string
  facility_code: string
  institutional_code: string | null
  governorate_name?: string
  directorate_name?: string
  is_model_hospital?: boolean
  total_revenue: number
  staffDues: number
  medSupplies: number
  total_deductions: number
  net_revenue: number
}

interface MonthDeadlineInfo {
  month: string
  deadline_date: string
  is_locked: boolean
  lock_scope: string
  notes: string | null
}

interface FiscalMonthRecord {
  month: string
  monthLabel: string
  quarter: number
  revenue: number
  staffDues: number
  medSupplies: number
  totalDeductions: number
  netRevenue: number
  isClosed: boolean
}

export default function DeductionsPage() {
  const supabase = createClient()
  const { isSuperAdmin, isMinistryViewer, facilityId, facilityName, canEditFinancials } = useUserRole()
  const isExecutive = isSuperAdmin || isMinistryViewer

  const [activeTab, setActiveTab] = useState<'current' | 'quarterly' | 'annual'>('current')
  const [selectedMonth, setSelectedMonth] = useState(toFirstOfMonth(new Date()))
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all')
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [entries, setEntries] = useState<DeductionEntry[]>([])
  const [staffDues, setStaffDues] = useState({ amount: '', notes: '' })
  const [medSupplies, setMedSupplies] = useState({ amount: '', notes: '' })
  const [totalMonthlyRevenue, setTotalMonthlyRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [deadlineInfo, setDeadlineInfo] = useState<MonthDeadlineInfo | null>(null)
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [superAdminEditMode, setSuperAdminEditMode] = useState(false)
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Sector Aggregate Data (for 'all' mode)
  const [sectorFacilities, setSectorFacilities] = useState<FacilityDeductionRow[]>([])
  const [sectorTotals, setSectorTotals] = useState({
    totalRevenue: 0,
    staffDues: 0,
    medSupplies: 0,
    totalDeductions: 0,
    netRevenue: 0,
  })

  // Search Filter in All mode
  const [tableSearch, setTableSearch] = useState('')

  // Fiscal Year Full Records (for Quarterly & Annual tabs)
  const [fiscalYearData, setFiscalYearData] = useState<FiscalMonthRecord[]>([])
  const [loadingFiscalData, setLoadingFiscalData] = useState(false)

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

  // 2. Fetch Selected Month Data (Either Sector All or Single Facility)
  useEffect(() => {
    async function loadMonthData() {
      setLoading(true)
      setMsg(null)

      try {
        if (selectedFacilityId === 'all' || (!selectedFacilityId && isExecutive)) {
          // A. جلب الإجماليات المركزية لكافة المنشآت
          const [
            { data: summaryRows },
            { data: dedEntriesResult },
          ] = await Promise.all([
            supabase
              .from('monthly_facility_summary')
              .select('*')
              .eq('month', selectedMonth),
            supabase
              .from('deductions')
              .select('facility_id, deduction_type, amount')
              .eq('month', selectedMonth),
          ])

          const facDedsMap = new Map<string, { staffDues: number; medSupplies: number }>()
          dedEntriesResult?.forEach((d: any) => {
            if (!facDedsMap.has(d.facility_id)) {
              facDedsMap.set(d.facility_id, { staffDues: 0, medSupplies: 0 })
            }
            const rec = facDedsMap.get(d.facility_id)!
            if (d.deduction_type === 'staff_dues') rec.staffDues += Number(d.amount || 0)
            else if (d.deduction_type === 'medicine_supplies') rec.medSupplies += Number(d.amount || 0)
          })

          let sumRev = 0
          let sumStaff = 0
          let sumMed = 0
          let sumDed = 0
          let sumNet = 0

          const mappedRows: FacilityDeductionRow[] = (summaryRows || []).map((row: any) => {
            const rev = Number(row.total_revenue || 0)
            const ded = Number(row.total_deductions || 0)
            const dInfo = facDedsMap.get(row.facility_id) || { staffDues: 0, medSupplies: 0 }

            const sDues = dInfo.staffDues > 0 ? dInfo.staffDues : ded * 0.4
            const mSupp = dInfo.medSupplies > 0 ? dInfo.medSupplies : ded * 0.6
            const net = Math.max(0, rev - ded)

            sumRev += rev
            sumStaff += sDues
            sumMed += mSupp
            sumDed += ded
            sumNet += net

            return {
              facility_id: row.facility_id,
              facility_name: row.facility_name,
              facility_code: row.facility_code,
              institutional_code: row.institutional_code || null,
              governorate_name: row.governorate_name,
              directorate_name: row.directorate_name,
              is_model_hospital: row.is_model_hospital,
              total_revenue: rev,
              staffDues: sDues,
              medSupplies: mSupp,
              total_deductions: ded,
              net_revenue: net,
            }
          })

          setSectorTotals({
            totalRevenue: sumRev,
            staffDues: sumStaff,
            medSupplies: sumMed,
            totalDeductions: sumDed,
            netRevenue: sumNet,
          })

          setSectorFacilities(mappedRows.sort((a, b) => b.total_deductions - a.total_deductions))
          setEntries([])
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
            setDeadlineInfo({
              month: selectedMonth,
              deadline_date: nextMonth.toISOString().split('T')[0],
              is_locked: false,
              lock_scope: 'all',
              notes: null,
            })
          }

          const { data: revEntries } = await supabase
            .from('revenue_entries')
            .select('amount')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)

          const totalRev = revEntries?.reduce((sum, r) => sum + Number(r.amount), 0) || 0
          setTotalMonthlyRevenue(totalRev)

          const { data: dedEntries } = await supabase
            .from('deductions')
            .select('*')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)

          if (dedEntries) {
            setEntries(dedEntries as any)
            const staff = dedEntries.find((d) => d.deduction_type === DEDUCTION_TYPES.STAFF_DUES)
            const med = dedEntries.find((d) => d.deduction_type === DEDUCTION_TYPES.MEDICINE_SUPPLIES)

            setStaffDues({
              amount: staff ? String(staff.amount) : '',
              notes: staff?.notes || '',
            })
            setMedSupplies({
              amount: med ? String(med.amount) : '',
              notes: med?.notes || '',
            })
          } else {
            setEntries([])
            setStaffDues({ amount: '', notes: '' })
            setMedSupplies({ amount: '', notes: '' })
          }

          // Fetch financial adjustments for deductions
          const { data: adjData } = await supabase
            .from('financial_adjustments')
            .select('*, profiles(full_name)')
            .eq('facility_id', selectedFacilityId)
            .eq('month', selectedMonth)
            .eq('record_type', 'deduction')
            .order('created_at', { ascending: false })

          if (adjData) setAdjustments(adjData)
          else setAdjustments([])
        }
      } catch (err) {
        console.error('Error loading deductions data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMonthData()
  }, [selectedFacilityId, selectedMonth, isExecutive])

  // 3. Single Facility Fiscal Year
  useEffect(() => {
    async function loadFiscalYearData() {
      if (!selectedFacilityId || selectedFacilityId === 'all') return
      setLoadingFiscalData(true)
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

        const { data: allRev } = await supabase
          .from('revenue_entries')
          .select('month, amount')
          .eq('facility_id', selectedFacilityId)
          .in('month', monthsList)

        const { data: allDeds } = await supabase
          .from('deductions')
          .select('month, deduction_type, amount')
          .eq('facility_id', selectedFacilityId)
          .in('month', monthsList)

        const { data: closures } = await supabase
          .from('monthly_closures')
          .select('month')
          .eq('facility_id', selectedFacilityId)

        const closedSet = new Set(closures?.map((c) => c.month) || [])

        const records: FiscalMonthRecord[] = monthsList.map((mStr) => {
          const mRev = allRev?.filter((r) => r.month === mStr).reduce((s, r) => s + Number(r.amount), 0) || 0
          const mStaff = allDeds?.filter((d) => d.month === mStr && d.deduction_type === 'staff_dues').reduce((s, d) => s + Number(d.amount), 0) || 0
          const mMed = allDeds?.filter((d) => d.month === mStr && d.deduction_type === 'medicine_supplies').reduce((s, d) => s + Number(d.amount), 0) || 0
          const mTotalDed = mStaff + mMed
          const mNet = Math.max(0, mRev - mTotalDed)

          return {
            month: mStr,
            monthLabel: formatMonthArabic(mStr),
            quarter: getFiscalQuarter(parseMonthDate(mStr)),
            revenue: mRev,
            staffDues: mStaff,
            medSupplies: mMed,
            totalDeductions: mTotalDed,
            netRevenue: mNet,
            isClosed: closedSet.has(mStr),
          }
        })

        setFiscalYearData(records)
      } catch (err) {
        console.error('Error loading fiscal year deductions:', err)
      } finally {
        setLoadingFiscalData(false)
      }
    }

    loadFiscalYearData()
  }, [selectedFacilityId, selectedMonth])

  // Filter facilities in All mode
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

  // Calculations for Single Facility
  const staffAmt = parseFloat(staffDues.amount || '0') || 0
  const medAmt = parseFloat(medSupplies.amount || '0') || 0
  const totalDeductions = staffAmt + medAmt
  const netRevenue = Math.max(0, totalMonthlyRevenue - totalDeductions)
  const expectedTotal15 = totalMonthlyRevenue * 0.15
  const expectedStaff40 = expectedTotal15 * 0.4
  const expectedMed60 = expectedTotal15 * 0.6

  function autoFill15() {
    setStaffDues((prev) => ({ ...prev, amount: expectedStaff40.toFixed(2) }))
    setMedSupplies((prev) => ({ ...prev, amount: expectedMed60.toFixed(2) }))
  }

  // Save for single facility
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFacilityId || selectedFacilityId === 'all') return

    setSaving(true)
    setMsg(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

      if (staffAmt >= 0 && staffDues.amount !== '') {
        const { error: err1 } = await supabase.from('deductions').upsert(
          {
            facility_id: selectedFacilityId,
            deduction_type: DEDUCTION_TYPES.STAFF_DUES,
            month: selectedMonth,
            amount: staffAmt,
            notes: staffDues.notes || null,
            created_by: user.id,
          },
          { onConflict: 'facility_id,deduction_type,month' }
        )
        if (err1) throw err1
      }

      if (medAmt >= 0 && medSupplies.amount !== '') {
        const { error: err2 } = await supabase.from('deductions').upsert(
          {
            facility_id: selectedFacilityId,
            deduction_type: DEDUCTION_TYPES.MEDICINE_SUPPLIES,
            month: selectedMonth,
            amount: medAmt,
            notes: medSupplies.notes || null,
            created_by: user.id,
          },
          { onConflict: 'facility_id,deduction_type,month' }
        )
        if (err2) throw err2
      }

      setMsg({ type: 'success', text: 'تم حفظ وتحديث مبالغ التجنيب القانوني (15%) بنجاح!' })

      const { data: reloaded } = await supabase
        .from('deductions')
        .select('*')
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
            <span>⚖️</span>
            <span>التجنيب والاستقطاع القانوني (15%)</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            {selectedFacilityId === 'all'
              ? `استعراض الإجماليات المركزية للتجنيب القانوني لكافة المنشآت لشهر ${formatMonthArabic(selectedMonth)}`
              : `احتساب وتوزيع مبالغ التجنيب (مستحقات 40% + أدوية 60%) لشهر ${formatMonthArabic(selectedMonth)}`}
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
                className="form-input !min-h-[34px] !py-1 text-xs font-bold border-amber-300 bg-white"
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
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-900 via-orange-950 to-amber-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">⚖️</span>
                <span className="text-xs text-amber-200 font-bold">إجمالي مبالغ التجنيب القانوني بالقطاع (15%):</span>
              </div>
              <span className="text-2xl sm:text-4xl font-black font-mono mt-1.5 block tracking-tight text-amber-300">
                {formatCurrency(sectorTotals.totalDeductions)}
              </span>
              <span className="text-xs text-amber-200/80 mt-1 block">
                من إجمالي حصيلة ذاتية قدرها: {formatCurrency(sectorTotals.totalRevenue)}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                المنشآت المسجلة: <b>{sectorFacilities.length}</b>
              </span>
              <span className="bg-emerald-500/20 text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-400/30">
                صافي الحصيلة (85%): <b>{formatCurrency(sectorTotals.netRevenue)}</b>
              </span>
            </div>
          </div>

          {/* 2 Main Statutory Deduction KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card !p-4 border bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-300 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <span>👥</span>
                  <span>مستحقات العاملين (40%)</span>
                </span>
                <span className="badge badge-warning text-[9px] font-mono font-bold">40% من التجنيب</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-amber-900 mt-2 block">
                {formatCurrency(sectorTotals.staffDues)}
              </span>
              <span className="text-[10px] text-amber-800/80 mt-1 block">
                المستحقات المقررة للكادر الطبي والإداري
              </span>
            </div>

            <div className="card !p-4 border bg-gradient-to-br from-teal-50 to-emerald-50/50 border-teal-300 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <span>💊</span>
                  <span>الأدوية والمستلزمات (60%)</span>
                </span>
                <span className="badge badge-info text-[9px] font-mono font-bold">60% من التجنيب</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-teal-900 mt-2 block">
                {formatCurrency(sectorTotals.medSupplies)}
              </span>
              <span className="text-[10px] text-teal-800/80 mt-1 block">
                مخصصات الأدوية والمستلزمات الطبية
              </span>
            </div>

            <div className="card !p-4 border bg-gradient-to-br from-blue-50 to-indigo-50/50 border-blue-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                  <span>💰</span>
                  <span>إجمالي الحصيلة (100%)</span>
                </span>
                <span className="badge badge-gray text-[9px] font-mono font-bold">الأساس</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-blue-900 mt-2 block">
                {formatCurrency(sectorTotals.totalRevenue)}
              </span>
              <span className="text-[10px] text-blue-800/80 mt-1 block">
                إجمالي إيرادات الـ 8 مصادر
              </span>
            </div>

            <div className="card !p-4 border bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span>🏛️</span>
                  <span>صافي الحصيلة (85%)</span>
                </span>
                <span className="badge badge-success text-[9px] font-mono font-bold">المتاح للصرف</span>
              </div>
              <span className="text-lg sm:text-xl font-black font-mono text-emerald-900 mt-2 block">
                {formatCurrency(sectorTotals.netRevenue)}
              </span>
              <span className="text-[10px] text-emerald-800/80 mt-1 block">
                الحصيلة المتبقية لصندوق الخدمة
              </span>
            </div>
          </div>

          {/* Detailed Facility Breakdown Table */}
          <div className="card shadow-2xs border border-[var(--color-border)] !p-0 overflow-hidden">
            <div className="p-3 bg-gray-50/90 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="section-title text-xs sm:text-sm font-bold flex items-center gap-2">
                  <span>🏥</span>
                  <span>تفصيل مبالغ التجنيب والاستقطاع حسب المنشآت ({filteredSectorFacilities.length})</span>
                </h3>
                <p className="text-[10px] text-gray-500">
                  انقر على أي منشأة للانتقال المباشر لاستمارة احتساب وتعديل مبالغ التجنيب الخاصة بها
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
                    <th className="py-2 px-3 text-left font-bold text-blue-900 bg-blue-50/50">إجمالي الإيراد (100%)</th>
                    <th className="py-2 px-3 text-left font-bold text-amber-900 bg-amber-50/70">مستحقات العاملين (40%)</th>
                    <th className="py-2 px-3 text-left font-bold text-teal-900 bg-teal-50/70">الأدوية والمستلزمات (60%)</th>
                    <th className="py-2 px-3 text-left font-bold text-amber-950 bg-amber-100/70">إجمالي التجنيب (15%)</th>
                    <th className="py-2 px-3 text-left font-bold text-emerald-900 bg-emerald-50/70">صافي الحصيلة (85%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredSectorFacilities.map((fac, idx) => (
                    <tr
                      key={fac.facility_id}
                      onClick={() => setSelectedFacilityId(fac.facility_id)}
                      className="hover:bg-amber-50/50 cursor-pointer transition-colors group"
                      title="انقر لفتح نموذج احتساب وتعديل هذه المنشأة"
                    >
                      <td className="py-2 px-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{fac.is_model_hospital ? '⭐' : '🏥'}</span>
                          <span className="group-hover:text-amber-900 transition-colors">{fac.facility_name}</span>
                          {fac.is_model_hospital && (
                            <span className="badge badge-warning text-[8px] px-1 py-0 font-bold">نموذجي</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 font-medium">{fac.governorate_name || '—'}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.facility_code}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.institutional_code || '—'}</td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-blue-950 bg-blue-50/30">
                        {formatCurrency(fac.total_revenue)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-amber-900 bg-amber-50/30">
                        {formatCurrency(fac.staffDues)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-teal-900 bg-teal-50/30">
                        {formatCurrency(fac.medSupplies)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-amber-950 bg-amber-100/40">
                        {formatCurrency(fac.total_deductions)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-emerald-950 bg-emerald-50/30">
                        {formatCurrency(fac.net_revenue)}
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
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>📅</span>
              <span>احتساب الشهر المختار</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quarterly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'quarterly'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
            >
              <span>📊</span>
              <span>التقرير الربع سنوي</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('annual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'annual'
                  ? 'bg-amber-800 text-white shadow-xs'
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
                className="mr-auto px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-all flex items-center gap-1.5"
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

          {/* Quick Metrics for Single Facility */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card !p-3 bg-blue-50 border border-blue-200">
              <span className="text-[10px] font-bold text-blue-900 block">إجمالي إيرادات الشهر</span>
              <span className="text-base font-black text-blue-950 font-mono mt-0.5 block">
                {formatCurrency(totalMonthlyRevenue)}
              </span>
            </div>
            <div className="card !p-3 bg-amber-50 border border-amber-300">
              <span className="text-[10px] font-bold text-amber-900 block">مستحقات العاملين (40%)</span>
              <span className="text-base font-black text-amber-950 font-mono mt-0.5 block">
                {formatCurrency(staffAmt)}
              </span>
            </div>
            <div className="card !p-3 bg-teal-50 border border-teal-200">
              <span className="text-[10px] font-bold text-teal-900 block">الأدوية والمستلزمات (60%)</span>
              <span className="text-base font-black text-teal-950 font-mono mt-0.5 block">
                {formatCurrency(medAmt)}
              </span>
            </div>
            <div className="card !p-3 bg-emerald-50 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-900 block">صافي الحصيلة (85%)</span>
              <span className="text-base font-black text-emerald-950 font-mono mt-0.5 block">
                {formatCurrency(netRevenue)}
              </span>
            </div>
          </div>

          {/* Form for Single Facility */}
          <form onSubmit={handleSave} className="space-y-5">
            <div className="card !p-0 shadow-2xs border border-gray-200 overflow-hidden">
              <div className="p-4 bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="section-title text-sm sm:text-base font-bold">
                    استمارة قيد التجنيب القانوني (15%) لشهر {formatMonthArabic(selectedMonth)}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    تطبيق قواعد المادة (14) من اللائحة التنظيمية
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={autoFill15}
                    className="btn btn-outline !min-h-[32px] !py-1 text-xs font-bold border-amber-500 text-amber-900 hover:bg-amber-50"
                  >
                    ⚡ احتساب تلقائي (15%)
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Staff Dues */}
                  <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <span>👥</span>
                        <span>مستحقات العاملين (40% من التجنيب)</span>
                      </label>
                      <span className="text-[10px] text-gray-500 font-mono">
                        المقترح: {formatCurrency(expectedStaff40)}
                      </span>
                    </div>

                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={staffDues.amount}
                      disabled={!canEditFinancials && !superAdminEditMode}
                      onChange={(e) => setStaffDues({ ...staffDues, amount: e.target.value })}
                      className="form-input !min-h-[36px] !py-1 text-xs font-mono font-bold w-full"
                    />
                    <input
                      type="text"
                      placeholder="ملاحظات..."
                      value={staffDues.notes}
                      disabled={!canEditFinancials && !superAdminEditMode}
                      onChange={(e) => setStaffDues({ ...staffDues, notes: e.target.value })}
                      className="form-input !min-h-[36px] !py-1 text-xs w-full"
                    />
                  </div>

                  {/* Medicine Supplies */}
                  <div className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                        <span>💊</span>
                        <span>الأدوية والمستلزمات (60% من التجنيب)</span>
                      </label>
                      <span className="text-[10px] text-gray-500 font-mono">
                        المقترح: {formatCurrency(expectedMed60)}
                      </span>
                    </div>

                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={medSupplies.amount}
                      disabled={!canEditFinancials && !superAdminEditMode}
                      onChange={(e) => setMedSupplies({ ...medSupplies, amount: e.target.value })}
                      className="form-input !min-h-[36px] !py-1 text-xs font-mono font-bold w-full"
                    />
                    <input
                      type="text"
                      placeholder="ملاحظات..."
                      value={medSupplies.notes}
                      disabled={!canEditFinancials && !superAdminEditMode}
                      onChange={(e) => setMedSupplies({ ...medSupplies, notes: e.target.value })}
                      className="form-input !min-h-[36px] !py-1 text-xs w-full"
                    />
                  </div>
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
                        className="btn btn-primary !min-h-[38px] !px-6 text-xs font-bold shadow-md bg-amber-800 hover:bg-amber-900"
                      >
                        {saving ? 'جاري الحفظ...' : '💾 حفظ وتثبيت مبالغ التجنيب'}
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
                  <span>تسويات التجنيب والاستقطاعات المقيدة لهذا الشهر ({adjustments.length})</span>
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
            recordType="deduction"
            onSuccess={() => {
              setMsg({ type: 'success', text: 'تم تسجيل تسوية التجنيب بنجاح' })
              setSelectedMonth((prev) => prev)
            }}
          />
        </div>
      )}
    </div>
  )
}
