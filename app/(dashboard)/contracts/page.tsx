'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'
import { CONTRACT_TYPE_LABELS, SUPPORT_PHONE, type ContractType } from '@/lib/constants'

interface Contract {
  id: string
  contract_type: ContractType
  company_name: string
  start_date: string
  duration_months: number
  total_contract_value: number
  is_active: boolean
  facility_id?: string
  allow_hospital_edit?: boolean
  unlocked_by?: string | null
  unlocked_at?: string | null
  facilities?: {
    name: string
    code: string
    is_model_hospital?: boolean
    institutional_code?: string | null
  }
  contract_payments?: { amount_paid: number }[]
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

interface FacilityContractsRow {
  facility_id: string
  facility_name: string
  facility_code: string
  institutional_code: string | null
  governorate_name?: string
  directorate_name?: string
  is_model_hospital?: boolean
  contracts_count: number
  total_contract_value: number
  total_paid: number
  security_val: number
  cleaning_val: number
  maintenance_val: number
  patient_food_val: number
  staff_food_val: number
}

export default function ContractsPage() {
  const supabase = createClient()
  const { isSuperAdmin, isMinistryViewer, facilityId, facilityName, canEditFinancials } = useUserRole()
  const isExecutive = isSuperAdmin || isMinistryViewer

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('all')
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<string>('all')

  // Sector Aggregate Data (for 'all' mode)
  const [sectorFacilities, setSectorFacilities] = useState<FacilityContractsRow[]>([])
  const [sectorTotals, setSectorTotals] = useState({
    totalContractsValue: 0,
    totalPaid: 0,
    security: 0,
    cleaning: 0,
    maintenance: 0,
    patient_food: 0,
    staff_food: 0,
    contractsCount: 0,
  })

  // Search Filter in All mode
  const [tableSearch, setTableSearch] = useState('')

  // Edit Contract Modal State
  const [editModalContract, setEditModalContract] = useState<Contract | null>(null)
  const [editFormData, setEditFormData] = useState({
    company_name: '',
    total_contract_value: '',
    start_date: '',
    duration_months: '12',
    is_active: true,
    allow_hospital_edit: false,
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Support Modal State
  const [supportModalContract, setSupportModalContract] = useState<Contract | null>(null)

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

  // 2. Fetch Contracts / Sector Aggregates
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        if (selectedFacilityId === 'all' || (!selectedFacilityId && isExecutive)) {
          // A. جلب إجماليات كافة العقود بالجمهورية
          const [
            { data: allContracts },
            { data: allFacilities },
          ] = await Promise.all([
            supabase
              .from('contracts')
              .select('*, contract_payments(amount_paid)'),
            supabase
              .from('facilities')
              .select('id, name, code, is_model_hospital, institutional_code, health_directorates(name, governorates(name))')
              .order('name'),
          ])

          const facMap = new Map<string, FacilityContractsRow>()

          allFacilities?.forEach((f: any) => {
            facMap.set(f.id, {
              facility_id: f.id,
              facility_name: f.name,
              facility_code: f.code,
              institutional_code: f.institutional_code || null,
              governorate_name: f.health_directorates?.governorates?.name,
              directorate_name: f.health_directorates?.name,
              is_model_hospital: f.is_model_hospital || false,
              contracts_count: 0,
              total_contract_value: 0,
              total_paid: 0,
              security_val: 0,
              cleaning_val: 0,
              maintenance_val: 0,
              patient_food_val: 0,
              staff_food_val: 0,
            })
          })

          let sumTotalVal = 0
          let sumTotalPaid = 0
          let sumSec = 0
          let sumCln = 0
          let sumMnt = 0
          let sumPFood = 0
          let sumSFood = 0

          allContracts?.forEach((c: any) => {
            const val = Number(c.total_contract_value || 0)
            const paid = (c.contract_payments || []).reduce((s: number, p: any) => s + Number(p.amount_paid || 0), 0)

            sumTotalVal += val
            sumTotalPaid += paid

            if (c.contract_type === 'security') sumSec += val
            else if (c.contract_type === 'cleaning') sumCln += val
            else if (c.contract_type === 'maintenance') sumMnt += val
            else if (c.contract_type === 'patient_food') sumPFood += val
            else if (c.contract_type === 'staff_food') sumSFood += val

            if (facMap.has(c.facility_id)) {
              const row = facMap.get(c.facility_id)!
              row.contracts_count += 1
              row.total_contract_value += val
              row.total_paid += paid

              if (c.contract_type === 'security') row.security_val += val
              else if (c.contract_type === 'cleaning') row.cleaning_val += val
              else if (c.contract_type === 'maintenance') row.maintenance_val += val
              else if (c.contract_type === 'patient_food') row.patient_food_val += val
              else if (c.contract_type === 'staff_food') row.staff_food_val += val
            }
          })

          setSectorTotals({
            totalContractsValue: sumTotalVal,
            totalPaid: sumTotalPaid,
            security: sumSec,
            cleaning: sumCln,
            maintenance: sumMnt,
            patient_food: sumPFood,
            staff_food: sumSFood,
            contractsCount: allContracts?.length || 0,
          })

          setSectorFacilities(
            Array.from(facMap.values()).sort((a, b) => b.total_contract_value - a.total_contract_value)
          )
          setContracts([])
        } else if (selectedFacilityId) {
          // B. جلب عقود منشأة محددة
          const { data } = await supabase
            .from('contracts')
            .select('*, contract_payments ( amount_paid )')
            .eq('facility_id', selectedFacilityId)
            .order('created_at', { ascending: false })

          if (data) setContracts(data as any)
          else setContracts([])
        }
      } catch (err) {
        console.error('Error loading contracts data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedFacilityId, isExecutive])

  // Filter in All mode
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

  // Filter in single facility mode
  const filteredContracts = useMemo(() => {
    if (filterType === 'all') return contracts
    return contracts.filter((c) => c.contract_type === filterType)
  }, [contracts, filterType])

  // Edit Contract Handlers
  function openEditModal(c: Contract) {
    setEditModalContract(c)
    setEditFormData({
      company_name: c.company_name,
      total_contract_value: String(c.total_contract_value),
      start_date: c.start_date,
      duration_months: String(c.duration_months),
      is_active: c.is_active,
      allow_hospital_edit: !!c.allow_hospital_edit,
    })
    setEditMsg(null)
  }

  async function handleToggleHospitalEdit(c: Contract) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const newVal = !c.allow_hospital_edit
      const { error } = await supabase
        .from('contracts')
        .update({
          allow_hospital_edit: newVal,
          unlocked_by: newVal ? user?.id : null,
          unlocked_at: newVal ? new Date().toISOString() : null,
        })
        .eq('id', c.id)

      if (error) throw error

      const { data } = await supabase
        .from('contracts')
        .select('*, contract_payments ( amount_paid )')
        .eq('facility_id', selectedFacilityId)
        .order('created_at', { ascending: false })
      if (data) setContracts(data as any)
    } catch (err: any) {
      console.error(err)
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editModalContract) return
    setSavingEdit(true)
    setEditMsg(null)

    try {
      const numValue = parseFloat(editFormData.total_contract_value)
      if (isNaN(numValue) || numValue <= 0) throw new Error('يرجى كتابة قيمة عقد صحيحة')

      const updatePayload: any = {
        company_name: editFormData.company_name.trim(),
        total_contract_value: numValue,
        start_date: editFormData.start_date,
        duration_months: parseInt(editFormData.duration_months) || 12,
        is_active: editFormData.is_active,
      }

      if (isSuperAdmin) {
        updatePayload.allow_hospital_edit = editFormData.allow_hospital_edit
      }

      const { error } = await supabase
        .from('contracts')
        .update(updatePayload)
        .eq('id', editModalContract.id)

      if (error) throw error

      setEditMsg({ type: 'success', text: 'تم تحديث بيانات العقد بنجاح!' })

      const { data } = await supabase
        .from('contracts')
        .select('*, contract_payments ( amount_paid )')
        .eq('facility_id', selectedFacilityId)
        .order('created_at', { ascending: false })
      if (data) setContracts(data as any)

      setTimeout(() => setEditModalContract(null), 1000)
    } catch (err: any) {
      setEditMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ التعديلات' })
    } finally {
      setSavingEdit(false)
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
            <span>📝</span>
            <span>العقود وسداد الخدمات</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            {selectedFacilityId === 'all'
              ? 'استعراض الإجماليات المركزية لكافة عقود الخدمات (الأمن، النظافة، الصيانة، التغذية)'
              : 'إدارة عقود الخدمات والتشغيل ومتابعة السداد الشهري'}
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
                className="form-input !min-h-[34px] !py-1 text-xs font-bold border-indigo-300 bg-white"
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

          {canEditFinancials && selectedFacilityId !== 'all' && (
            <Link
              href="/contracts/new"
              className="btn btn-primary !min-h-[34px] !py-1 text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <span>➕</span>
              <span>تسجيل عقد جديد</span>
            </Link>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          2. وضع الإجماليات المركزية (Sector Totals View)
      ───────────────────────────────────────────── */}
      {selectedFacilityId === 'all' ? (
        <div className="space-y-5">
          {/* Executive Sector Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📝</span>
                <span className="text-xs text-indigo-200 font-bold">إجمالي قيم عقود الخدمات بالقطاع:</span>
              </div>
              <span className="text-2xl sm:text-4xl font-black font-mono mt-1.5 block tracking-tight text-indigo-200">
                {formatCurrency(sectorTotals.totalContractsValue)}
              </span>
              <span className="text-xs text-indigo-200/80 mt-1 block">
                المسدد الفعلي منها حتى الآن: {formatCurrency(sectorTotals.totalPaid)}
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono">
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                المنشآت المسجلة: <b>{sectorFacilities.length}</b>
              </span>
              <span className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                العقود النشطة: <b>{sectorTotals.contractsCount}</b>
              </span>
            </div>
          </div>

          {/* 5 Contract Type KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="card !p-3 border bg-indigo-50/70 border-indigo-200">
              <span className="text-[10px] font-bold text-indigo-950 block">🛡️ عقود الأمن والحراسة</span>
              <span className="text-sm sm:text-base font-black font-mono text-indigo-900 mt-1 block">
                {formatCurrencyShort(sectorTotals.security)}
              </span>
            </div>
            <div className="card !p-3 border bg-teal-50/70 border-teal-200">
              <span className="text-[10px] font-bold text-teal-950 block">🧹 عقود النظافة والتطهير</span>
              <span className="text-sm sm:text-base font-black font-mono text-teal-900 mt-1 block">
                {formatCurrencyShort(sectorTotals.cleaning)}
              </span>
            </div>
            <div className="card !p-3 border bg-amber-50/70 border-amber-200">
              <span className="text-[10px] font-bold text-amber-950 block">🔧 عقود الصيانة والتشغيل</span>
              <span className="text-sm sm:text-base font-black font-mono text-amber-900 mt-1 block">
                {formatCurrencyShort(sectorTotals.maintenance)}
              </span>
            </div>
            <div className="card !p-3 border bg-rose-50/70 border-rose-200">
              <span className="text-[10px] font-bold text-rose-950 block">🍲 تغذية المرضى</span>
              <span className="text-sm sm:text-base font-black font-mono text-rose-900 mt-1 block">
                {formatCurrencyShort(sectorTotals.patient_food)}
              </span>
            </div>
            <div className="card !p-3 border bg-purple-50/70 border-purple-200">
              <span className="text-[10px] font-bold text-purple-950 block">🍱 تغذية النوبتجيات</span>
              <span className="text-sm sm:text-base font-black font-mono text-purple-900 mt-1 block">
                {formatCurrencyShort(sectorTotals.staff_food)}
              </span>
            </div>
          </div>

          {/* Detailed Facility Breakdown Table */}
          <div className="card shadow-2xs border border-[var(--color-border)] !p-0 overflow-hidden">
            <div className="p-3 bg-gray-50/90 border-b border-[var(--color-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h3 className="section-title text-xs sm:text-sm font-bold flex items-center gap-2">
                  <span>🏥</span>
                  <span>تفصيل عقود الخدمات حسب المنشآت ({filteredSectorFacilities.length})</span>
                </h3>
                <p className="text-[10px] text-gray-500">
                  انقر على أي منشأة للانتقال المباشر لبيان عقودها المسجلة ومتابعة السداد
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
                    <th className="py-2 px-2 text-center">عدد العقود</th>
                    <th className="py-2 px-3 text-left font-bold text-indigo-900 bg-indigo-50/70">الأمن</th>
                    <th className="py-2 px-3 text-left font-bold text-teal-900 bg-teal-50/70">النظافة</th>
                    <th className="py-2 px-3 text-left font-bold text-amber-900 bg-amber-50/70">الصيانة</th>
                    <th className="py-2 px-3 text-left font-bold text-rose-900 bg-rose-50/70">تغذية المرضى</th>
                    <th className="py-2 px-3 text-left font-bold text-purple-900 bg-purple-50/70">تغذية النوبتجيات</th>
                    <th className="py-2 px-3 text-left font-bold text-indigo-950 bg-indigo-100/70">إجمالي قيمة العقود</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredSectorFacilities.map((fac, idx) => (
                    <tr
                      key={fac.facility_id}
                      onClick={() => setSelectedFacilityId(fac.facility_id)}
                      className="hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                      title="انقر لفتح عقود وسداد هذه المنشأة"
                    >
                      <td className="py-2 px-2 text-center text-gray-400 font-bold">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-gray-900">
                        <div className="flex items-center gap-1.5">
                          <span>{fac.is_model_hospital ? '⭐' : '🏥'}</span>
                          <span className="group-hover:text-indigo-900 transition-colors">{fac.facility_name}</span>
                          {fac.is_model_hospital && (
                            <span className="badge badge-warning text-[8px] px-1 py-0 font-bold">نموذجي</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center text-gray-600 font-medium">{fac.governorate_name || '—'}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.facility_code}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">{fac.institutional_code || '—'}</td>
                      <td className="py-2 px-2 text-center font-mono text-gray-700">{fac.contracts_count}</td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-indigo-900 bg-indigo-50/30">
                        {fac.security_val > 0 ? formatCurrency(fac.security_val) : '—'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-teal-900 bg-teal-50/30">
                        {fac.cleaning_val > 0 ? formatCurrency(fac.cleaning_val) : '—'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-amber-900 bg-amber-50/30">
                        {fac.maintenance_val > 0 ? formatCurrency(fac.maintenance_val) : '—'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-rose-900 bg-rose-50/30">
                        {fac.patient_food_val > 0 ? formatCurrency(fac.patient_food_val) : '—'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-purple-900 bg-purple-50/30">
                        {fac.staff_food_val > 0 ? formatCurrency(fac.staff_food_val) : '—'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-indigo-950 bg-indigo-100/40">
                        {formatCurrency(fac.total_contract_value)}
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
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 hover:bg-indigo-100 transition-all flex items-center gap-1.5"
              >
                <span>🏛️</span>
                <span>العودة للإجماليات العامة</span>
              </button>
            )}

            {/* Filter by contract type */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-500 font-bold">تصفية حسب النوع:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="form-input !min-h-[32px] !py-0.5 text-xs font-medium"
              >
                <option value="all">كافة العقود ({contracts.length})</option>
                <option value="security">🛡️ أمن وحراسة</option>
                <option value="cleaning">🧹 نظافة وتطهير</option>
                <option value="maintenance">🔧 صيانة وتشغيل</option>
                <option value="patient_food">🍲 تغذية مرضى</option>
                <option value="staff_food">🍱 تغذية نوبتجيات</option>
              </select>
            </div>
          </div>

          {/* Contracts Cards / Table */}
          <div className="card shadow-2xs border border-gray-200 !p-0 overflow-hidden">
            <div className="p-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
              <h3 className="section-title text-xs sm:text-sm font-bold">
                العقود المسجلة للمنشأة ({filteredContracts.length})
              </h3>
            </div>

            {filteredContracts.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-xs">
                لا توجد عقود مسجلة مطابقة لهذه المنشأة.
              </div>
            ) : (
              <div className="table-wrapper overflow-x-auto">
                <table className="table w-full text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                      <th className="py-2 px-2 text-center w-8">م</th>
                      <th className="py-2 px-3 text-right">نوع العقد</th>
                      <th className="py-2 px-3 text-right">اسم الشركة</th>
                      <th className="py-2 px-2 text-center">تاريخ البدء</th>
                      <th className="py-2 px-2 text-center">المدة (أشهر)</th>
                      <th className="py-2 px-3 text-left">قيمة العقد الكلية</th>
                      <th className="py-2 px-3 text-left">المسدد حتى الآن</th>
                      <th className="py-2 px-2 text-center">الحالة</th>
                      <th className="py-2 px-3 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredContracts.map((c, idx) => {
                      const totalPaid = (c.contract_payments || []).reduce((s, p) => s + Number(p.amount_paid || 0), 0)
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="py-2 px-2 text-center text-gray-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-gray-900">
                            {CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type}
                          </td>
                          <td className="py-2 px-3 text-gray-700">{c.company_name}</td>
                          <td className="py-2 px-2 text-center font-mono text-gray-600">{c.start_date}</td>
                          <td className="py-2 px-2 text-center font-mono">{c.duration_months}</td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-indigo-950">
                            {formatCurrency(c.total_contract_value)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-emerald-900">
                            {formatCurrency(totalPaid)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <span className={`badge ${c.is_active ? 'badge-success' : 'badge-gray'} text-[9px]`}>
                              {c.is_active ? 'سارٍ' : 'منتهٍ'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Link
                                href={`/contracts/${c.id}/payments`}
                                className="btn btn-outline !min-h-[26px] !py-0.5 !px-2 text-[10px] font-bold text-emerald-800 border-emerald-300 hover:bg-emerald-50"
                              >
                                💳 السداد
                              </Link>
                              {(isSuperAdmin || c.allow_hospital_edit) && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(c)}
                                  className="btn btn-outline !min-h-[26px] !py-0.5 !px-2 text-[10px] font-bold text-blue-800 border-blue-300 hover:bg-blue-50"
                                >
                                  ✏️ تعديل
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModalContract && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setEditModalContract(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-blue-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                <span>✏️</span>
                <span>تعديل بيانات العقد</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditModalContract(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>

            {editMsg && (
              <div className={editMsg.type === 'success' ? 'alert-success text-xs' : 'alert-error text-xs'}>
                {editMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">اسم الشركة المنفذة</label>
                <input
                  type="text"
                  required
                  value={editFormData.company_name}
                  onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                  className="form-input w-full text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">قيمة العقد الكلية (ج.م)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editFormData.total_contract_value}
                  onChange={(e) => setEditFormData({ ...editFormData, total_contract_value: e.target.value })}
                  className="form-input w-full font-mono font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">تاريخ البدء</label>
                  <input
                    type="date"
                    required
                    value={editFormData.start_date}
                    onChange={(e) => setEditFormData({ ...editFormData, start_date: e.target.value })}
                    className="form-input w-full font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">المدة (أشهر)</label>
                  <input
                    type="number"
                    required
                    value={editFormData.duration_months}
                    onChange={(e) => setEditFormData({ ...editFormData, duration_months: e.target.value })}
                    className="form-input w-full font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditModalContract(null)}
                  className="btn btn-outline !min-h-[34px] !py-1 text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn btn-primary !min-h-[34px] !py-1 text-xs font-bold"
                >
                  {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
