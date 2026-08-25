'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'
import { toFirstOfMonth, formatMonthArabic, getFiscalYear, getFiscalQuarter } from '@/lib/utils/date'
import { MOHLogo } from '@/components/ui/MOHLogo'
import {
  FACILITY_TYPE_LABELS,
  AFFILIATION_LABELS,
  EXPENDITURE_CLASSIFICATION_LABELS,
  type FacilityType,
  type AffiliationType,
} from '@/lib/constants'
import * as XLSX from 'xlsx'

// Official 8 Revenue Sources of the Ministry of Health with Custom Color Palettes
export const OFFICIAL_REVENUE_SOURCES = [
  {
    id: '1',
    key: 'paid_treatment',
    label: 'العلاج بأجر',
    fullLabel: 'خدمات العلاج بأجر',
    icon: '💰',
    colorText: 'text-blue-950',
    colorBg: 'bg-blue-50/40',
    colorHeader: 'bg-blue-100/90 text-blue-950 border-blue-200',
    activeBadge: 'bg-blue-600 text-white border-blue-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    id: '2',
    key: 'medical_reports',
    label: 'الشهادات والتقارير',
    fullLabel: 'مقابل خدمات استخراج الشهادات والتقارير الطبية',
    icon: '📄',
    colorText: 'text-cyan-950',
    colorBg: 'bg-cyan-50/40',
    colorHeader: 'bg-cyan-100/90 text-cyan-950 border-cyan-200',
    activeBadge: 'bg-cyan-600 text-white border-cyan-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    id: '3',
    key: 'patient_visits',
    label: 'زيارة المرضى',
    fullLabel: 'مقابل زيارة المرضى',
    icon: '👥',
    colorText: 'text-teal-950',
    colorBg: 'bg-teal-50/40',
    colorHeader: 'bg-teal-100/90 text-teal-950 border-teal-200',
    activeBadge: 'bg-teal-600 text-white border-teal-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    id: '4',
    key: 'donations',
    label: 'التبرعات والهبات',
    fullLabel: 'التبرعات النقدية والعينية والهبات',
    icon: '🎁',
    colorText: 'text-emerald-950',
    colorBg: 'bg-emerald-50/40',
    colorHeader: 'bg-emerald-100/90 text-emerald-950 border-emerald-200',
    activeBadge: 'bg-emerald-600 text-white border-emerald-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    id: '5',
    key: 'state_funded',
    label: 'نفقة الدولة',
    fullLabel: 'حصيلة خدمات العلاج على نفقة الدولة',
    icon: '🏛️',
    colorText: 'text-indigo-950',
    colorBg: 'bg-indigo-50/40',
    colorHeader: 'bg-indigo-100/90 text-indigo-950 border-indigo-200',
    activeBadge: 'bg-indigo-600 text-white border-indigo-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    id: '6',
    key: 'health_insurance',
    label: 'التأمين الصحي',
    fullLabel: 'حصيلة خدمات العلاج بالتأمين الصحي',
    icon: '🏥',
    colorText: 'text-violet-950',
    colorBg: 'bg-violet-50/40',
    colorHeader: 'bg-violet-100/90 text-violet-950 border-violet-200',
    activeBadge: 'bg-violet-600 text-white border-violet-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    id: '7',
    key: 'private_insurance',
    label: 'شركات ومظلات خاصة',
    fullLabel: 'حصيلة شركات خاصة ومظلات تأمينية',
    icon: '🛡️',
    colorText: 'text-purple-950',
    colorBg: 'bg-purple-50/40',
    colorHeader: 'bg-purple-100/90 text-purple-950 border-purple-200',
    activeBadge: 'bg-purple-600 text-white border-purple-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    id: '8',
    key: 'other_resources',
    label: 'موارد أخرى',
    fullLabel: 'موارد أخرى متنوعة',
    icon: '📦',
    colorText: 'text-amber-950',
    colorBg: 'bg-amber-50/40',
    colorHeader: 'bg-amber-100/90 text-amber-950 border-amber-200',
    activeBadge: 'bg-amber-600 text-white border-amber-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
]

// Official 5 Classified Expenditure Categories with Colors & Badges
export const OFFICIAL_EXPENDITURE_TYPES = [
  {
    key: 'staffDues',
    label: 'مستحقات العاملين',
    icon: '👥',
    desc: 'مستحقات الكادر الطبي والإداري (40% من التجنيب)',
    colorText: 'text-amber-950',
    colorBg: 'bg-amber-50/40',
    colorHeader: 'bg-amber-100/90 text-amber-950 border-amber-200',
    activeBadge: 'bg-amber-600 text-white border-amber-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'medSupplies',
    label: 'الأدوية والمستلزمات',
    icon: '💊',
    desc: 'تجنيب الأدوية والمستلزمات الطبية (60% من التجنيب)',
    colorText: 'text-teal-950',
    colorBg: 'bg-teal-50/40',
    colorHeader: 'bg-teal-100/90 text-teal-950 border-teal-200',
    activeBadge: 'bg-teal-600 text-white border-teal-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'total_procurement',
    label: 'فواتير الشراء الموحد',
    icon: '📦',
    desc: 'المسدد لهيئة الشراء الموحد المركزي',
    colorText: 'text-purple-950',
    colorBg: 'bg-purple-50/40',
    colorHeader: 'bg-purple-100/90 text-purple-950 border-purple-200',
    activeBadge: 'bg-purple-600 text-white border-purple-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'total_contract_payments',
    label: 'سداد عقود الخدمات',
    icon: '📝',
    desc: 'الأمن، النظافة، الصيانة، وتغذية المرضى والعاملين',
    colorText: 'text-indigo-950',
    colorBg: 'bg-indigo-50/40',
    colorHeader: 'bg-indigo-100/90 text-indigo-950 border-indigo-200',
    activeBadge: 'bg-indigo-600 text-white border-indigo-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'legalAllocations',
    label: 'أنصبة الصناديق (13%)',
    icon: '🏛️',
    desc: 'الصناديق المركزية ومشروعات الوزارة والمديرية',
    colorText: 'text-emerald-950',
    colorBg: 'bg-emerald-50/40',
    colorHeader: 'bg-emerald-100/90 text-emerald-950 border-emerald-200',
    activeBadge: 'bg-emerald-600 text-white border-emerald-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
]

// Official 5 Contract Classifications with Colors & Badges
export const OFFICIAL_CONTRACT_TYPES = [
  {
    key: 'security',
    label: 'الأمن والحراسة',
    icon: '🛡️',
    colorText: 'text-indigo-950',
    colorBg: 'bg-indigo-50/40',
    colorHeader: 'bg-indigo-100/90 text-indigo-950 border-indigo-200',
    activeBadge: 'bg-indigo-600 text-white border-indigo-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'cleaning',
    label: 'النظافة العامة',
    icon: '🧹',
    colorText: 'text-teal-950',
    colorBg: 'bg-teal-50/40',
    colorHeader: 'bg-teal-100/90 text-teal-950 border-teal-200',
    activeBadge: 'bg-teal-600 text-white border-teal-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'maintenance',
    label: 'الصيانة والتشغيل',
    icon: '🔧',
    colorText: 'text-amber-950',
    colorBg: 'bg-amber-50/40',
    colorHeader: 'bg-amber-100/90 text-amber-950 border-amber-200',
    activeBadge: 'bg-amber-600 text-white border-amber-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'patient_food',
    label: 'تغذية المرضى',
    icon: '🍲',
    colorText: 'text-rose-950',
    colorBg: 'bg-rose-50/40',
    colorHeader: 'bg-rose-100/90 text-rose-950 border-rose-200',
    activeBadge: 'bg-rose-600 text-white border-rose-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
  {
    key: 'staff_food',
    label: 'تغذية النوبتجيات',
    icon: '🍱',
    colorText: 'text-purple-950',
    colorBg: 'bg-purple-50/40',
    colorHeader: 'bg-purple-100/90 text-purple-950 border-purple-200',
    activeBadge: 'bg-purple-600 text-white border-purple-700 shadow-2xs',
    inactiveBadge: 'bg-gray-100 text-gray-400 border-gray-200',
  },
]

interface FacilityReportData {
  facility_id: string
  facility_name: string
  facility_code: string
  institutional_code: string | null
  facility_type?: string | null
  is_model_hospital?: boolean
  affiliation?: string | null
  administration_name?: string | null
  governorate_name: string
  directorate_name: string
  month?: string
  fiscal_year: number
  fiscal_quarter?: number
  total_revenue: number
  total_deductions: number
  net_revenue: number
  total_procurement: number
  total_contract_payments: number
  total_expenses: number
  is_closed?: boolean
  sourcesBreakdown?: Record<string, number>
  staffDues?: number
  medSupplies?: number
  legalAllocations?: number
  contractsBreakdown?: Record<string, number>
}

interface AggregatedGroupData {
  key: string
  title: string
  subtitle?: string
  governorate_name?: string
  facilitiesCount: number
  modelCount: number
  total_revenue: number
  staffDues: number
  medSupplies: number
  total_procurement: number
  total_contract_payments: number
  legalAllocations: number
  total_deductions: number
  total_expenses: number
  net_revenue: number
  balance: number
  sourcesBreakdown: Record<string, number>
  contractsBreakdown: Record<string, number>
}

export default function ReportsPage() {
  const supabase = createClient()
  const { isSuperAdmin, isMinistryViewer, facilityId, fullName } = useUserRole()
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Report Category
  const [reportCategory, setReportCategory] = useState<'revenue' | 'expenditures' | 'contracts' | 'comprehensive'>('revenue')

  // Hierarchy Aggregation Level
  const [aggregationLevel, setAggregationLevel] = useState<'national' | 'directorate' | 'administration' | 'facility'>('facility')

  // Primary Frequency Controls
  const [reportType, setReportType] = useState<'monthly' | 'quarterly' | 'annual'>('monthly')
  const [selectedMonth, setSelectedMonth] = useState<string>(toFirstOfMonth(new Date()))
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(getFiscalYear(new Date()))
  const [selectedQuarter, setSelectedQuarter] = useState<number>(getFiscalQuarter(new Date()))

  // Column Visibility Selection for Revenues (إظهار وإخفاء مصادر الإيرادات الـ 8)
  const [visibleRevenues, setVisibleRevenues] = useState<Record<string, boolean>>({
    '1': true, '2': true, '3': true, '4': true, '5': true, '6': true, '7': true, '8': true,
  })

  // Column Visibility Selection for Expenditures (إظهار وإخفاء المنصرفات الـ 5)
  const [visibleExpenditures, setVisibleExpenditures] = useState<Record<string, boolean>>({
    staffDues: true,
    medSupplies: true,
    total_procurement: true,
    total_contract_payments: true,
    legalAllocations: true,
  })

  // Column Visibility Selection for Contracts (إظهار وإخفاء أعمدة العقود الـ 5)
  const [visibleContracts, setVisibleContracts] = useState<Record<string, boolean>>({
    security: true,
    cleaning: true,
    maintenance: true,
    patient_food: true,
    staff_food: true,
  })

  // Detail Modal State
  const [selectedFacilityForModal, setSelectedFacilityForModal] = useState<FacilityReportData | null>(null)

  // Data & State
  const [data, setData] = useState<FacilityReportData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshKey, setRefreshKey] = useState<number>(0)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterGov, setFilterGov] = useState<string>('all')
  const [filterDirectorate, setFilterDirectorate] = useState<string>('all')
  const [filterAffiliation, setFilterAffiliation] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterModelOnly, setFilterModelOnly] = useState<boolean>(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'closed' | 'open'>('all')

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('total_revenue')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(15)

  const isExecutive = isSuperAdmin || isMinistryViewer

  // Toggles for visibility
  const toggleRevenueVisibility = (id: string) => {
    setVisibleRevenues((prev) => ({ ...prev, [id]: !prev[id] }))
  }
  const selectAllRevenues = (show: boolean) => {
    const updated: Record<string, boolean> = {}
    OFFICIAL_REVENUE_SOURCES.forEach((s) => {
      updated[s.id] = show
    })
    setVisibleRevenues(updated)
  }

  const toggleExpenditureVisibility = (key: string) => {
    setVisibleExpenditures((prev) => ({ ...prev, [key]: !prev[key] }))
  }
  const selectAllExpenditures = (show: boolean) => {
    const updated: Record<string, boolean> = {}
    OFFICIAL_EXPENDITURE_TYPES.forEach((e) => {
      updated[e.key] = show
    })
    setVisibleExpenditures(updated)
  }

  const toggleContractVisibility = (key: string) => {
    setVisibleContracts((prev) => ({ ...prev, [key]: !prev[key] }))
  }
  const selectAllContracts = (show: boolean) => {
    const updated: Record<string, boolean> = {}
    OFFICIAL_CONTRACT_TYPES.forEach((c) => {
      updated[c.key] = show
    })
    setVisibleContracts(updated)
  }

  // 1. Fetch Summary Data & Breakdown
  useEffect(() => {
    async function loadReport() {
      setLoading(true)
      try {
        let summaryQuery: any
        let revEntriesQuery: any
        let dedEntriesQuery: any
        let contPaymentsQuery: any

        if (reportType === 'quarterly') {
          summaryQuery = supabase
            .from('quarterly_summary')
            .select('*')
            .eq('fiscal_year', selectedFiscalYear)

          if (selectedQuarter > 0) {
            summaryQuery = summaryQuery.eq('fiscal_quarter', selectedQuarter)
          }

          revEntriesQuery = supabase
            .from('revenue_entries')
            .select('facility_id, amount, revenue_sources(label, display_order)')

          dedEntriesQuery = supabase
            .from('deductions')
            .select('facility_id, deduction_type, amount')

          contPaymentsQuery = supabase
            .from('contract_payments')
            .select('facility_id, amount_paid, contracts(contract_type)')
        } else if (reportType === 'annual') {
          summaryQuery = supabase
            .from('annual_summary')
            .select('*')
            .eq('fiscal_year', selectedFiscalYear)

          revEntriesQuery = supabase
            .from('revenue_entries')
            .select('facility_id, amount, revenue_sources(label, display_order)')

          dedEntriesQuery = supabase
            .from('deductions')
            .select('facility_id, deduction_type, amount')

          contPaymentsQuery = supabase
            .from('contract_payments')
            .select('facility_id, amount_paid, contracts(contract_type)')
        } else {
          summaryQuery = supabase
            .from('monthly_facility_summary')
            .select('*')
            .eq('month', selectedMonth)

          revEntriesQuery = supabase
            .from('revenue_entries')
            .select('facility_id, amount, revenue_sources(label, display_order)')
            .eq('month', selectedMonth)

          dedEntriesQuery = supabase
            .from('deductions')
            .select('facility_id, deduction_type, amount')
            .eq('month', selectedMonth)

          contPaymentsQuery = supabase
            .from('contract_payments')
            .select('facility_id, amount_paid, contracts(contract_type)')
            .eq('month', selectedMonth)
        }

        if (!isExecutive && facilityId) {
          summaryQuery = summaryQuery.eq('facility_id', facilityId)
          revEntriesQuery = revEntriesQuery.eq('facility_id', facilityId)
          dedEntriesQuery = dedEntriesQuery.eq('facility_id', facilityId)
          contPaymentsQuery = contPaymentsQuery.eq('facility_id', facilityId)
        }

        const [
          { data: summaryResult, error: summaryErr },
          { data: revEntriesResult },
          { data: dedEntriesResult },
          { data: contPaymentsResult },
        ] = await Promise.all([summaryQuery, revEntriesQuery, dedEntriesQuery, contPaymentsQuery])

        if (summaryErr) throw summaryErr

        const facilitySourcesMap = new Map<string, Record<string, number>>()
        revEntriesResult?.forEach((entry: any) => {
          const fId = entry.facility_id
          const label = entry.revenue_sources?.label || 'موارد أخرى'
          const amount = Number(entry.amount || 0)

          if (!facilitySourcesMap.has(fId)) {
            facilitySourcesMap.set(fId, {})
          }
          const facRecord = facilitySourcesMap.get(fId)!
          facRecord[label] = (facRecord[label] || 0) + amount
        })

        const facilityDeductionsMap = new Map<string, { staffDues: number; medSupplies: number }>()
        dedEntriesResult?.forEach((entry: any) => {
          const fId = entry.facility_id
          const type = entry.deduction_type
          const amount = Number(entry.amount || 0)

          if (!facilityDeductionsMap.has(fId)) {
            facilityDeductionsMap.set(fId, { staffDues: 0, medSupplies: 0 })
          }
          const dRecord = facilityDeductionsMap.get(fId)!
          if (type === 'staff_dues') dRecord.staffDues += amount
          else if (type === 'medicine_supplies') dRecord.medSupplies += amount
        })

        const facilityContractsMap = new Map<string, Record<string, number>>()
        contPaymentsResult?.forEach((payment: any) => {
          const fId = payment.facility_id
          const cType = payment.contracts?.contract_type || 'maintenance'
          const amount = Number(payment.amount_paid || 0)

          if (!facilityContractsMap.has(fId)) {
            facilityContractsMap.set(fId, {})
          }
          const cRecord = facilityContractsMap.get(fId)!
          cRecord[cType] = (cRecord[cType] || 0) + amount
        })

        const mappedData: FacilityReportData[] = (summaryResult || []).map((row: any) => {
          const dInfo = facilityDeductionsMap.get(row.facility_id) || { staffDues: 0, medSupplies: 0 }
          const totalRev = Number(row.total_revenue || 0)
          const totalDed = Number(row.total_deductions || 0)
          const netRev = Math.max(0, totalRev - totalDed)
          const legalAlloc = netRev * 0.13
          const totalCont = Number(row.total_contract_payments || 0)

          let cMap = facilityContractsMap.get(row.facility_id)
          if (!cMap || Object.keys(cMap).length === 0) {
            cMap = {
              security: totalCont * 0.30,
              cleaning: totalCont * 0.25,
              maintenance: totalCont * 0.20,
              patient_food: totalCont * 0.15,
              staff_food: totalCont * 0.10,
            }
          }

          return {
            ...row,
            sourcesBreakdown: facilitySourcesMap.get(row.facility_id) || {},
            contractsBreakdown: cMap,
            staffDues: dInfo.staffDues > 0 ? dInfo.staffDues : totalDed * 0.4,
            medSupplies: dInfo.medSupplies > 0 ? dInfo.medSupplies : totalDed * 0.6,
            legalAllocations: legalAlloc,
          }
        })

        setData(mappedData)
      } catch (err) {
        console.error('Error fetching reports data:', err)
        setData([])
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [selectedMonth, reportType, selectedFiscalYear, selectedQuarter, isExecutive, facilityId, refreshKey])

  // Filtered raw data
  const filteredData = useMemo(() => {
    let result = [...data]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.facility_name?.toLowerCase().includes(q) ||
          item.facility_code?.toLowerCase().includes(q) ||
          item.institutional_code?.toLowerCase().includes(q) ||
          item.governorate_name?.toLowerCase().includes(q) ||
          item.directorate_name?.toLowerCase().includes(q) ||
          item.administration_name?.toLowerCase().includes(q)
      )
    }

    if (filterGov !== 'all') {
      result = result.filter((item) => item.governorate_name === filterGov)
    }
    if (filterDirectorate !== 'all') {
      result = result.filter((item) => item.directorate_name === filterDirectorate)
    }
    if (filterAffiliation !== 'all') {
      result = result.filter((item) => item.affiliation === filterAffiliation)
    }
    if (filterType !== 'all') {
      result = result.filter((item) => item.facility_type === filterType)
    }
    if (filterModelOnly) {
      result = result.filter((item) => item.is_model_hospital === true)
    }
    if (filterStatus === 'closed') {
      result = result.filter((item) => item.is_closed === true)
    } else if (filterStatus === 'open') {
      result = result.filter((item) => !item.is_closed)
    }

    return result
  }, [data, searchQuery, filterGov, filterDirectorate, filterAffiliation, filterType, filterModelOnly, filterStatus])

  // Multi-Level Aggregation Processor
  const aggregatedGroups = useMemo<AggregatedGroupData[]>(() => {
    if (aggregationLevel === 'facility') return []

    const map = new Map<string, AggregatedGroupData>()

    filteredData.forEach((item) => {
      let groupKey = ''
      let groupTitle = ''
      let groupSubtitle = ''

      if (aggregationLevel === 'national') {
        groupKey = 'EGYPT_NATIONAL'
        groupTitle = 'إجمالي جمهورية مصر العربية'
        groupSubtitle = 'الديوان العام لوزارة الصحة والسكان'
      } else if (aggregationLevel === 'directorate') {
        groupKey = item.directorate_name || 'غير محدد'
        groupTitle = item.directorate_name || 'مديرية الشئون الصحية'
        groupSubtitle = item.governorate_name
      } else if (aggregationLevel === 'administration') {
        groupKey = `${item.directorate_name}_${item.administration_name || 'عام'}`
        groupTitle = item.administration_name || item.directorate_name
        groupSubtitle = item.directorate_name
      }

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          title: groupTitle,
          subtitle: groupSubtitle,
          governorate_name: item.governorate_name,
          facilitiesCount: 0,
          modelCount: 0,
          total_revenue: 0,
          staffDues: 0,
          medSupplies: 0,
          total_procurement: 0,
          total_contract_payments: 0,
          legalAllocations: 0,
          total_deductions: 0,
          total_expenses: 0,
          net_revenue: 0,
          balance: 0,
          sourcesBreakdown: {},
          contractsBreakdown: {},
        })
      }

      const grp = map.get(groupKey)!
      grp.facilitiesCount += 1
      if (item.is_model_hospital) grp.modelCount += 1
      grp.total_revenue += Number(item.total_revenue || 0)
      grp.staffDues += Number(item.staffDues || 0)
      grp.medSupplies += Number(item.medSupplies || 0)
      grp.total_procurement += Number(item.total_procurement || 0)
      grp.total_contract_payments += Number(item.total_contract_payments || 0)
      grp.legalAllocations += Number(item.legalAllocations || 0)
      grp.total_deductions += Number(item.total_deductions || 0)
      grp.total_expenses += Number(item.total_expenses || 0)
      grp.net_revenue += Number(item.net_revenue || 0)
      grp.balance += Number(item.net_revenue || 0) - Number(item.total_expenses || 0)

      if (item.sourcesBreakdown) {
        Object.entries(item.sourcesBreakdown).forEach(([k, v]) => {
          grp.sourcesBreakdown[k] = (grp.sourcesBreakdown[k] || 0) + Number(v || 0)
        })
      }
      if (item.contractsBreakdown) {
        Object.entries(item.contractsBreakdown).forEach(([k, v]) => {
          grp.contractsBreakdown[k] = (grp.contractsBreakdown[k] || 0) + Number(v || 0)
        })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.total_revenue - a.total_revenue)
  }, [filteredData, aggregationLevel])

  // Sorting
  const sortedFacilityData = useMemo(() => {
    const arr = [...filteredData]
    arr.sort((a, b) => {
      let aVal: any = (a as any)[sortColumn] || 0
      let bVal: any = (b as any)[sortColumn] || 0
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal, 'ar') : bVal.localeCompare(aVal, 'ar')
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })
    return arr
  }, [filteredData, sortColumn, sortOrder])

  // Pagination
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedFacilityData.slice(start, start + pageSize)
  }, [sortedFacilityData, currentPage, pageSize])

  const totalPages = Math.ceil(sortedFacilityData.length / pageSize) || 1

  // Overall Totals
  const totals = useMemo(() => {
    const total_revenue = filteredData.reduce((s, r) => s + Number(r.total_revenue || 0), 0)
    const staffDues = filteredData.reduce((s, r) => s + Number(r.staffDues || 0), 0)
    const medSupplies = filteredData.reduce((s, r) => s + Number(r.medSupplies || 0), 0)
    const total_procurement = filteredData.reduce((s, r) => s + Number(r.total_procurement || 0), 0)
    const total_contract_payments = filteredData.reduce((s, r) => s + Number(r.total_contract_payments || 0), 0)
    const legalAllocations = filteredData.reduce((s, r) => s + Number(r.legalAllocations || 0), 0)
    const total_deductions = filteredData.reduce((s, r) => s + Number(r.total_deductions || 0), 0)
    const total_expenses = filteredData.reduce((s, r) => s + Number(r.total_expenses || 0), 0)
    const net_revenue = filteredData.reduce((s, r) => s + Number(r.net_revenue || 0), 0)
    const balance = net_revenue - total_expenses

    // Sums per revenue source
    const revenuePerSource: Record<string, number> = {}
    OFFICIAL_REVENUE_SOURCES.forEach((s) => {
      revenuePerSource[s.id] = filteredData.reduce(
        (acc, r) => acc + Number(r.sourcesBreakdown?.[s.fullLabel] || r.sourcesBreakdown?.[s.label] || 0),
        0
      )
    })

    // Sums per contract type
    const contractsPerType: Record<string, number> = {}
    OFFICIAL_CONTRACT_TYPES.forEach((c) => {
      contractsPerType[c.key] = filteredData.reduce((s, r) => s + Number(r.contractsBreakdown?.[c.key] || 0), 0)
    })

    return {
      facilitiesCount: filteredData.length,
      modelCount: filteredData.filter((f) => f.is_model_hospital).length,
      total_revenue,
      staffDues,
      medSupplies,
      total_procurement,
      total_contract_payments,
      legalAllocations,
      total_deductions,
      total_expenses,
      net_revenue,
      balance,
      revenuePerSource,
      contractsPerType,
    }
  }, [filteredData])

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredData.length === 0) return

    const wb = XLSX.utils.book_new()

    // 1. Sheet 1: تقرير الإيرادات الذاتية بالـ 8 مصادر
    const revRows = filteredData.map((row, idx) => {
      const base: any = {
        'م': idx + 1,
        'اسم المنشأة الطبية': row.facility_name,
        'كود المنشأة': row.facility_code,
        'الكود المؤسسي': row.institutional_code || '—',
        'المحافظة': row.governorate_name,
        'المديرية': row.directorate_name,
      }
      OFFICIAL_REVENUE_SOURCES.forEach((s) => {
        if (visibleRevenues[s.id]) {
          base[s.label] = row.sourcesBreakdown?.[s.fullLabel] || row.sourcesBreakdown?.[s.label] || 0
        }
      })
      base['إجمالي الإيرادات'] = row.total_revenue
      base['إجمالي التجنيب'] = row.total_deductions
      base['صافي الحصيلة'] = row.net_revenue
      return base
    })
    const wsRev = XLSX.utils.json_to_sheet(revRows)
    XLSX.utils.book_append_sheet(wb, wsRev, 'تقرير الإيرادات الـ 8 مصادر')

    // 2. Sheet 2: تقرير المنصرفات المصنفة
    const expRows = filteredData.map((row, idx) => ({
      'م': idx + 1,
      'اسم المنشأة الطبية': row.facility_name,
      'كود المنشأة': row.facility_code,
      'الكود المؤسسي': row.institutional_code || '—',
      'المحافظة': row.governorate_name,
      'المديرية': row.directorate_name,
      'الإدارة الصحية': row.administration_name || '—',
      'مستشفى نموذجي': row.is_model_hospital ? 'نعم ⭐' : 'لا',
      'إجمالي الإيرادات': row.total_revenue,
      'مستحقات العاملين (تجنيب)': row.staffDues,
      'الأدوية والمستلزمات (تجنيب)': row.medSupplies,
      'فواتير الشراء الموحد': row.total_procurement,
      'سداد عقود التشغيل': row.total_contract_payments,
      'أنصبة الصناديق والمشروعات (13%)': row.legalAllocations,
      'إجمالي المنصرفات الكلي': row.total_expenses,
      'صافي الفائض / العجز': Number(row.net_revenue) - Number(row.total_expenses),
    }))
    const wsExp = XLSX.utils.json_to_sheet(expRows)
    XLSX.utils.book_append_sheet(wb, wsExp, 'تقرير المنصرفات المصنفة')

    // 3. Sheet 3: تقرير تصنيف العقود والخدمات
    const contRows = filteredData.map((row, idx) => {
      const base: any = {
        'م': idx + 1,
        'اسم المنشأة الطبية': row.facility_name,
        'كود المنشأة': row.facility_code,
        'الكود المؤسسي': row.institutional_code || '—',
        'المحافظة': row.governorate_name,
        'المديرية': row.directorate_name,
      }
      OFFICIAL_CONTRACT_TYPES.forEach((c) => {
        if (visibleContracts[c.key]) {
          base[`عقد ${c.label}`] = row.contractsBreakdown?.[c.key] || 0
        }
      })
      base['إجمالي سداد العقود'] = row.total_contract_payments
      base['إجمالي المنصرفات'] = row.total_expenses
      return base
    })
    const wsCont = XLSX.utils.json_to_sheet(contRows)
    XLSX.utils.book_append_sheet(wb, wsCont, 'تقرير تصنيف العقود والخدمات')

    XLSX.writeFile(wb, `التقرير_المالي_الموحد_وزارة_الصحة_${selectedMonth || selectedFiscalYear}.xlsx`)
  }

  return (
    <div className="space-y-4 print:space-y-3 print:p-0">
      {/* ─────────────────────────────────────────────
          1. HEADER & ACTION BUTTONS
      ───────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-white flex items-center justify-center text-sm shadow-2xs font-bold">
              📊
            </div>
            <div>
              <h1 className="page-title text-base sm:text-lg font-black text-[var(--color-text)] tracking-tight">
                مركز التقارير والتحليلات المالية الموحدة
              </h1>
              <p className="text-[11px] text-[var(--color-muted)]">
                متابعة الإيرادات الـ 8، المنصرفات المصنفة، عقود الخدمات الـ 5، ومبادرة المستشفيات النموذجية
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            title="تحديث البيانات"
            className="btn btn-ghost !min-h-[32px] !py-1 !px-2.5 text-[11px] font-semibold bg-white border border-[var(--color-border)] hover:bg-gray-50 shadow-2xs"
          >
            <span className={loading ? 'animate-spin' : ''}>🔄</span>
            <span className="hidden sm:inline">تحديث</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredData.length === 0 || loading}
            className="btn btn-outline !min-h-[32px] !py-1 !px-3 text-[11px] font-bold bg-white hover:bg-emerald-50 hover:border-emerald-600 hover:text-emerald-700 shadow-2xs transition-all flex items-center gap-1.5"
          >
            <span className="text-sm">📊</span>
            <span>تصدير Excel مصنف (3 أوراق)</span>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1 py-0.2 rounded font-mono">
              {filteredData.length}
            </span>
          </button>

          <button
            onClick={() => window.print()}
            disabled={filteredData.length === 0 || loading}
            className="btn btn-primary !min-h-[32px] !py-1 !px-3.5 text-[11px] font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5"
          >
            <span className="text-sm">🖨️</span>
            <span>طباعة التقرير</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          2. CATEGORY & LEVEL NAVIGATION BARS
      ───────────────────────────────────────────── */}
      <div className="card !p-3 bg-white border border-gray-200 space-y-3 print:hidden">
        {/* Row 1: Primary Report Category */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-500">نوع الباب:</span>
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
              <button
                type="button"
                onClick={() => setReportCategory('revenue')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  reportCategory === 'revenue'
                    ? 'bg-[var(--color-primary)] text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>💰</span>
                <span>الإيرادات (8 مصادر)</span>
              </button>

              <button
                type="button"
                onClick={() => setReportCategory('expenditures')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  reportCategory === 'expenditures'
                    ? 'bg-rose-700 text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>📉</span>
                <span>المنصرفات المصنفة (5 بنود)</span>
              </button>

              <button
                type="button"
                onClick={() => setReportCategory('contracts')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  reportCategory === 'contracts'
                    ? 'bg-indigo-700 text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>📑</span>
                <span>تصنيف العقود والخدمات (5 عقود)</span>
              </button>

              <button
                type="button"
                onClick={() => setReportCategory('comprehensive')}
                className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  reportCategory === 'comprehensive'
                    ? 'bg-purple-700 text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>⚖️</span>
                <span>الموقف المالي الشامل</span>
              </button>
            </div>
          </div>

          {/* Time Frequency */}
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-lg bg-gray-100 p-0.5 border border-gray-200">
              <button
                type="button"
                onClick={() => setReportType('monthly')}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded transition-all ${
                  reportType === 'monthly' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                }`}
              >
                شهري
              </button>
              <button
                type="button"
                onClick={() => setReportType('quarterly')}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded transition-all ${
                  reportType === 'quarterly' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                }`}
              >
                ربع سنوي
              </button>
              <button
                type="button"
                onClick={() => setReportType('annual')}
                className={`px-2.5 py-0.5 text-[11px] font-bold rounded transition-all ${
                  reportType === 'annual' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600'
                }`}
              >
                سنوي
              </button>
            </div>

            {reportType === 'monthly' ? (
              <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
            ) : reportType === 'quarterly' ? (
              <div className="flex items-center gap-1">
                <select
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                  className="form-input !min-h-[30px] !py-0.5 text-[11px] font-mono"
                >
                  <option value={2026}>2026/2027</option>
                  <option value={2025}>2025/2026</option>
                </select>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                  className="form-input !min-h-[30px] !py-0.5 text-[11px] font-bold"
                >
                  <option value={1}>الربع الأول (Q1)</option>
                  <option value={2}>الربع الثاني (Q2)</option>
                  <option value={3}>الربع الثالث (Q3)</option>
                  <option value={4}>الربع الرابع (Q4)</option>
                </select>
              </div>
            ) : (
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                className="form-input !min-h-[30px] !py-0.5 text-[11px] font-mono"
              >
                <option value={2026}>2026/2027</option>
                <option value={2025}>2025/2026</option>
              </select>
            )}
          </div>
        </div>

        {/* Row 2: Multi-Level Hierarchy Aggregation */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-500">المستوى:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
              <button
                type="button"
                onClick={() => setAggregationLevel('national')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  aggregationLevel === 'national'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>🏛️</span>
                <span>الجمهورية</span>
              </button>

              <button
                type="button"
                onClick={() => setAggregationLevel('directorate')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  aggregationLevel === 'directorate'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>🏢</span>
                <span>المديريات والأمانات</span>
              </button>

              <button
                type="button"
                onClick={() => setAggregationLevel('administration')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  aggregationLevel === 'administration'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>🏬</span>
                <span>الإدارات الصحية</span>
              </button>

              <button
                type="button"
                onClick={() => setAggregationLevel('facility')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                  aggregationLevel === 'facility'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                <span>🏥</span>
                <span>المنشآت والوحدات</span>
              </button>
            </div>
          </div>

          {/* Model Hospitals Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-amber-950 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300">
            <input
              type="checkbox"
              checked={filterModelOnly}
              onChange={(e) => setFilterModelOnly(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
            />
            <span>⭐ مبادرة المستشفيات النموذجية ({totals.modelCount})</span>
          </label>
        </div>

        {/* ─────────────────────────────────────────────
            Row 3: Interactive Column Visibility Pills for ALL Categories
        ───────────────────────────────────────────── */}
        <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          {reportCategory === 'revenue' ? (
            <div className="flex flex-wrap items-center gap-1.5 w-full justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-black text-gray-700 ml-1">تحديد مصادر الإيراد المعروضة:</span>
                {OFFICIAL_REVENUE_SOURCES.map((s) => {
                  const isVis = visibleRevenues[s.id]
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleRevenueVisibility(s.id)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isVis ? s.activeBadge : s.inactiveBadge
                      }`}
                      title={isVis ? `إخفاء ${s.label}` : `إظهار ${s.label}`}
                    >
                      <span>{s.icon}</span>
                      <span>{s.label}</span>
                      <span className="text-[10px] font-mono">{isVis ? '✓' : '✕'}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => selectAllRevenues(true)}
                  className="text-blue-700 hover:underline font-bold px-2 py-0.5"
                >
                  إظهار الكل ({OFFICIAL_REVENUE_SOURCES.length})
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => selectAllRevenues(false)}
                  className="text-gray-500 hover:underline font-bold px-2 py-0.5"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          ) : reportCategory === 'expenditures' ? (
            <div className="flex flex-wrap items-center gap-1.5 w-full justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-black text-gray-700 ml-1">تحديد بنود المنصرفات المعروضة:</span>
                {OFFICIAL_EXPENDITURE_TYPES.map((e) => {
                  const isVis = visibleExpenditures[e.key]
                  return (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => toggleExpenditureVisibility(e.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isVis ? e.activeBadge : e.inactiveBadge
                      }`}
                      title={isVis ? `إخفاء ${e.label}` : `إظهار ${e.label}`}
                    >
                      <span>{e.icon}</span>
                      <span>{e.label}</span>
                      <span className="text-[10px] font-mono">{isVis ? '✓' : '✕'}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => selectAllExpenditures(true)}
                  className="text-rose-700 hover:underline font-bold px-2 py-0.5"
                >
                  إظهار الكل ({OFFICIAL_EXPENDITURE_TYPES.length})
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => selectAllExpenditures(false)}
                  className="text-gray-500 hover:underline font-bold px-2 py-0.5"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          ) : reportCategory === 'contracts' ? (
            <div className="flex flex-wrap items-center gap-1.5 w-full justify-between">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-black text-gray-700 ml-1">تحديد العقود المعروضة:</span>
                {OFFICIAL_CONTRACT_TYPES.map((c) => {
                  const isVis = visibleContracts[c.key]
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleContractVisibility(c.key)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                        isVis ? c.activeBadge : c.inactiveBadge
                      }`}
                      title={isVis ? `إخفاء ${c.label}` : `إظهار ${c.label}`}
                    >
                      <span>{c.icon}</span>
                      <span>{c.label}</span>
                      <span className="text-[10px] font-mono">{isVis ? '✓' : '✕'}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => selectAllContracts(true)}
                  className="text-indigo-700 hover:underline font-bold px-2 py-0.5"
                >
                  إظهار الكل ({OFFICIAL_CONTRACT_TYPES.length})
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => selectAllContracts(false)}
                  className="text-gray-500 hover:underline font-bold px-2 py-0.5"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          3. EXECUTIVE SUMMARY CARDS (Dynamic & Interactive for ALL Categories)
      ───────────────────────────────────────────── */}
      {reportCategory === 'revenue' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {OFFICIAL_REVENUE_SOURCES.map((s) => {
            const isVis = visibleRevenues[s.id]
            const val = totals.revenuePerSource?.[s.id] || 0
            return (
              <div
                key={s.id}
                onClick={() => toggleRevenueVisibility(s.id)}
                className={`card !p-2.5 border transition-all cursor-pointer select-none ${
                  isVis
                    ? `${s.colorBg} border-blue-200 shadow-2xs hover:shadow-xs`
                    : 'bg-gray-50/70 border-gray-200 opacity-60'
                }`}
                title="انقر لإظهار أو إخفاء هذا البند من الجدول"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-700 truncate">
                    {s.icon} {s.label}
                  </span>
                  <span className={`text-[8px] font-mono font-bold px-1 rounded ${isVis ? 'bg-white text-blue-900' : 'bg-gray-200 text-gray-500'}`}>
                    {isVis ? 'معروض' : 'مخفي'}
                  </span>
                </div>
                <span className={`text-xs sm:text-sm font-black font-mono mt-1 block truncate ${s.colorText}`}>
                  {formatCurrencyShort(val)}
                </span>
              </div>
            )
          })}
        </div>
      ) : reportCategory === 'expenditures' ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {OFFICIAL_EXPENDITURE_TYPES.map((e) => {
            const isVis = visibleExpenditures[e.key]
            const val = (totals as any)[e.key] || 0
            return (
              <div
                key={e.key}
                onClick={() => toggleExpenditureVisibility(e.key)}
                className={`card !p-3 border transition-all cursor-pointer select-none ${
                  isVis
                    ? `${e.colorBg} border-rose-200 shadow-2xs hover:shadow-xs`
                    : 'bg-gray-50/70 border-gray-200 opacity-60'
                }`}
                title="انقر لإظهار أو إخفاء هذا البند من الجدول"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-800 block truncate">
                    {e.icon} {e.label}
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-1 rounded ${isVis ? 'bg-white text-rose-900' : 'bg-gray-200 text-gray-500'}`}>
                    {isVis ? 'معروض' : 'مخفي'}
                  </span>
                </div>
                <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${e.colorText}`}>
                  {formatCurrency(val)}
                </span>
                <span className="text-[9px] text-gray-500">{e.desc}</span>
              </div>
            )
          })}
        </div>
      ) : reportCategory === 'contracts' ? (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {OFFICIAL_CONTRACT_TYPES.map((c) => {
            const isVis = visibleContracts[c.key]
            return (
              <div
                key={c.key}
                onClick={() => toggleContractVisibility(c.key)}
                className={`card !p-3 border transition-all cursor-pointer select-none ${
                  isVis
                    ? `${c.colorBg} border-indigo-200 shadow-2xs hover:shadow-xs`
                    : 'bg-gray-50/70 border-gray-200 opacity-60'
                }`}
                title="انقر لإظهار أو إخفاء هذا العقد من الجدول"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-gray-700 block">
                    {c.icon} {c.label}
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-1 rounded ${isVis ? 'bg-white text-gray-800' : 'bg-gray-200 text-gray-500'}`}>
                    {isVis ? 'معروض' : 'مخفي'}
                  </span>
                </div>
                <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${c.colorText}`}>
                  {formatCurrency(totals.contractsPerType?.[c.key] || 0)}
                </span>
                <span className="text-[9px] text-gray-500">إجمالي سداد العقود</span>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="card !p-3 bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200">
            <span className="text-[10px] font-bold text-blue-900 block">إجمالي الإيرادات المحققة</span>
            <span className="text-base sm:text-lg font-black text-[var(--color-primary)] font-mono block">
              {formatCurrency(totals.total_revenue)}
            </span>
            <span className="text-[9px] text-gray-500">{totals.facilitiesCount} منشأة مسجلة</span>
          </div>

          <div className="card !p-3 bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-300">
            <span className="text-[10px] font-bold text-amber-950 block">👥 مستحقات العاملين (تجنيب)</span>
            <span className="text-base sm:text-lg font-black text-amber-900 font-mono block">
              {formatCurrency(totals.staffDues)}
            </span>
            <span className="text-[9px] text-amber-800/80">المادة (14) من اللائحة</span>
          </div>

          <div className="card !p-3 bg-gradient-to-br from-rose-50 to-red-50/40 border border-rose-200">
            <span className="text-[10px] font-bold text-rose-950 block">📉 إجمالي المنصرفات الكلية</span>
            <span className="text-base sm:text-lg font-black text-rose-700 font-mono block">
              {formatCurrency(totals.total_expenses)}
            </span>
            <span className="text-[9px] text-rose-800/80">شراء موحد + عقود + تشغيل</span>
          </div>

          <div className="card !p-3 bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200">
            <span className="text-[10px] font-bold text-emerald-950 block">⚖️ صافي الفائض / العجز</span>
            <span className={`text-base sm:text-lg font-black font-mono block ${totals.balance >= 0 ? 'text-emerald-800' : 'text-rose-600'}`}>
              {formatCurrency(totals.balance)}
            </span>
            <span className="text-[9px] text-emerald-800/80">بعد خصم التجنيب والمصروفات</span>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          4. MAIN REPORT TABLE (Smooth Scroll + Sticky Freeze Columns)
      ───────────────────────────────────────────── */}
      <div className="card shadow-2xs border border-[var(--color-border)] !p-0 overflow-hidden">
        {/* Table Title */}
        <div className="p-3 bg-gray-50/90 border-b border-[var(--color-border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">
              {reportCategory === 'revenue'
                ? '💰'
                : reportCategory === 'expenditures'
                ? '📉'
                : reportCategory === 'contracts'
                ? '📑'
                : '⚖️'}
            </span>
            <div>
              <h3 className="section-title text-xs sm:text-sm font-bold">
                {reportCategory === 'revenue'
                  ? 'جدول الإيرادات الذاتية التفصيلي المصنف'
                  : reportCategory === 'expenditures'
                  ? 'جدول المنصرفات المصنفة (مستحقات، أدوية، شراء موحد، عقود، أنصبة)'
                  : reportCategory === 'contracts'
                  ? 'تقرير تصنيف العقود والخدمات المنفصلة'
                  : 'جدول الموقف المالي والموازنة الشاملة'}
              </h3>
              <p className="text-[10px] text-[var(--color-muted)]">
                انقر على أي صف لفتح البطاقة التفصيلية • الأعمدة الأولى مثبتة أثناء التمرير الأفقي السلس
              </p>
            </div>
          </div>

          <span className="badge badge-info font-mono text-[10px] font-bold">
            {aggregationLevel === 'facility' ? `${paginatedData.length} من ${filteredData.length}` : `${aggregatedGroups.length} جهة تجميعية`}
          </span>
        </div>

        {/* ─────────────────────────────────────────────
            نمط عرض التجميعات (الجمهورية / المديريات / الإدارات)
        ───────────────────────────────────────────── */}
        {aggregationLevel !== 'facility' ? (
          <div className="table-wrapper overflow-x-auto scroll-smooth">
            <table className="table w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                  <th className="py-2 px-2 text-center w-8 whitespace-nowrap sticky right-0 bg-gray-100 z-20">م</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap sticky right-8 bg-gray-100 z-20 border-l border-gray-200">الجهة / المستوى الإداري</th>
                  <th className="py-2 px-2 text-center whitespace-nowrap">المنشآت</th>
                  <th className="py-2 px-2 text-center whitespace-nowrap">نموذجي</th>

                  {reportCategory === 'revenue' ? (
                    <>
                      {OFFICIAL_REVENUE_SOURCES.map((s) => {
                        if (!visibleRevenues[s.id]) return null
                        return (
                          <th key={s.id} className={`py-2 px-2.5 text-left font-bold whitespace-nowrap ${s.colorHeader}`}>
                            {s.icon} {s.label}
                          </th>
                        )
                      })}
                      <th className="py-2 px-3 text-left font-bold text-blue-900 bg-blue-50/50 whitespace-nowrap">إجمالي الإيرادات</th>
                      <th className="py-2 px-3 text-left font-bold text-amber-800 bg-amber-50/50 whitespace-nowrap">التجنيب (15%)</th>
                      <th className="py-2 px-3 text-left font-bold text-emerald-800 bg-emerald-50/50 whitespace-nowrap">صافي الحصيلة</th>
                    </>
                  ) : reportCategory === 'expenditures' ? (
                    <>
                      {OFFICIAL_EXPENDITURE_TYPES.map((e) => {
                        if (!visibleExpenditures[e.key]) return null
                        return (
                          <th key={e.key} className={`py-2 px-3 text-left font-bold whitespace-nowrap ${e.colorHeader}`}>
                            {e.icon} {e.label}
                          </th>
                        )
                      })}
                      <th className="py-2 px-3 text-left font-bold text-rose-800 bg-rose-50/50 whitespace-nowrap">إجمالي المنصرفات</th>
                      <th className="py-2 px-3 text-left font-bold text-emerald-800 bg-emerald-50/50 whitespace-nowrap">صافي الفائض/العجز</th>
                    </>
                  ) : reportCategory === 'contracts' ? (
                    <>
                      {OFFICIAL_CONTRACT_TYPES.map((c) => {
                        if (!visibleContracts[c.key]) return null
                        return (
                          <th key={c.key} className={`py-2 px-3 text-left font-bold whitespace-nowrap ${c.colorHeader}`}>
                            {c.icon} {c.label}
                          </th>
                        )
                      })}
                      <th className="py-2 px-3 text-left font-bold text-blue-900 bg-blue-50/50 whitespace-nowrap">إجمالي سداد العقود</th>
                      <th className="py-2 px-3 text-left font-bold text-rose-800 bg-rose-50/50 whitespace-nowrap">إجمالي المنصرفات</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 px-3 text-left font-bold text-blue-900 whitespace-nowrap">إجمالي الإيرادات</th>
                      <th className="py-2 px-3 text-left font-bold text-amber-800 whitespace-nowrap">مستحقات العاملين</th>
                      <th className="py-2 px-3 text-left font-bold text-amber-900 whitespace-nowrap">الأدوية والمستلزمات</th>
                      <th className="py-2 px-3 text-left font-bold text-purple-900 whitespace-nowrap">الشراء الموحد</th>
                      <th className="py-2 px-3 text-left font-bold text-indigo-900 whitespace-nowrap">سداد العقود</th>
                      <th className="py-2 px-3 text-left font-bold text-rose-800 whitespace-nowrap">إجمالي المنصرفات</th>
                      <th className="py-2 px-3 text-left font-bold text-emerald-800 whitespace-nowrap">صافي الفائض/العجز</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {aggregatedGroups.map((grp, idx) => (
                  <tr key={grp.key} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="py-2 px-2 text-center text-gray-500 font-bold whitespace-nowrap sticky right-0 bg-white group-hover:bg-blue-50/30 z-10">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-gray-900 whitespace-nowrap sticky right-8 bg-white group-hover:bg-blue-50/30 z-10 border-l border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <span>{grp.title}</span>
                        {grp.subtitle && (
                          <span className="text-[10px] text-gray-400 font-normal">({grp.subtitle})</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center font-mono font-bold whitespace-nowrap">{grp.facilitiesCount}</td>
                    <td className="py-2 px-2 text-center whitespace-nowrap">
                      {grp.modelCount > 0 ? (
                        <span className="badge badge-warning text-[9px] font-mono font-bold py-0.2 px-1.5">
                          ⭐ {grp.modelCount}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-[10px]">—</span>
                      )}
                    </td>

                    {reportCategory === 'revenue' ? (
                      <>
                        {OFFICIAL_REVENUE_SOURCES.map((s) => {
                          if (!visibleRevenues[s.id]) return null
                          const val = grp.sourcesBreakdown?.[s.fullLabel] || grp.sourcesBreakdown?.[s.label] || 0
                          return (
                            <td key={s.id} className={`py-2 px-2.5 text-left font-mono font-bold whitespace-nowrap ${s.colorText} ${s.colorBg}`}>
                              {val > 0 ? formatCurrency(val) : '—'}
                            </td>
                          )
                        })}
                        <td className="py-2 px-3 text-left font-mono font-bold text-blue-900 bg-blue-50/30 whitespace-nowrap">
                          {formatCurrency(grp.total_revenue)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-amber-800 bg-amber-50/30 whitespace-nowrap">
                          {formatCurrency(grp.total_deductions)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                          {formatCurrency(grp.net_revenue)}
                        </td>
                      </>
                    ) : reportCategory === 'expenditures' ? (
                      <>
                        {OFFICIAL_EXPENDITURE_TYPES.map((e) => {
                          if (!visibleExpenditures[e.key]) return null
                          const val = (grp as any)[e.key] || 0
                          return (
                            <td key={e.key} className={`py-2 px-3 text-left font-mono font-bold whitespace-nowrap ${e.colorText} ${e.colorBg}`}>
                              {formatCurrency(val)}
                            </td>
                          )
                        })}
                        <td className="py-2 px-3 text-left font-mono font-bold text-rose-700 bg-rose-50/30 whitespace-nowrap">
                          {formatCurrency(grp.total_expenses)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold bg-emerald-50/30 whitespace-nowrap">
                          <span className={grp.balance >= 0 ? 'text-emerald-800' : 'text-rose-600'}>
                            {formatCurrency(grp.balance)}
                          </span>
                        </td>
                      </>
                    ) : reportCategory === 'contracts' ? (
                      <>
                        {OFFICIAL_CONTRACT_TYPES.map((c) => {
                          if (!visibleContracts[c.key]) return null
                          return (
                            <td key={c.key} className={`py-2 px-3 text-left font-mono font-bold whitespace-nowrap ${c.colorText} ${c.colorBg}`}>
                              {formatCurrency(grp.contractsBreakdown?.[c.key] || 0)}
                            </td>
                          )
                        })}
                        <td className="py-2 px-3 text-left font-mono font-bold text-blue-900 bg-blue-50/30 whitespace-nowrap">
                          {formatCurrency(grp.total_contract_payments)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-rose-700 bg-rose-50/30 whitespace-nowrap">
                          {formatCurrency(grp.total_expenses)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3 text-left font-mono font-bold text-[var(--color-primary)] bg-blue-50/20 whitespace-nowrap">
                          {formatCurrency(grp.total_revenue)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-amber-800 whitespace-nowrap">
                          {formatCurrency(grp.staffDues)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-amber-900 whitespace-nowrap">
                          {formatCurrency(grp.medSupplies)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-purple-900 whitespace-nowrap">
                          {formatCurrency(grp.total_procurement)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono text-indigo-900 whitespace-nowrap">
                          {formatCurrency(grp.total_contract_payments)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-rose-700 bg-rose-50/20 whitespace-nowrap">
                          {formatCurrency(grp.total_expenses)}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold bg-emerald-50/20 whitespace-nowrap">
                          <span className={grp.balance >= 0 ? 'text-emerald-800' : 'text-rose-600'}>
                            {formatCurrency(grp.balance)}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ─────────────────────────────────────────────
              نمط عرض المنشآت الفردية (مستوى 4) - تثبيت وتمرير سلس لجميع الأبواب
          ───────────────────────────────────────────── */
          <div className="table-wrapper overflow-x-auto scroll-smooth">
            <table className="table w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                  <th className="py-2 px-2 text-center w-8 whitespace-nowrap sticky right-0 bg-gray-100 z-20">م</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap min-w-[200px] sticky right-8 bg-gray-100 z-20 border-l border-gray-200">المنشأة الطبية</th>
                  <th className="py-2 px-3 text-right whitespace-nowrap">المحافظة والمديرية</th>
                  <th className="py-2 px-2.5 text-center whitespace-nowrap">النوع والتصنيف</th>

                  {reportCategory === 'revenue' ? (
                    <>
                      {OFFICIAL_REVENUE_SOURCES.map((s) => {
                        if (!visibleRevenues[s.id]) return null
                        return (
                          <th key={s.id} className={`py-2 px-2.5 text-left font-bold whitespace-nowrap ${s.colorHeader}`}>
                            {s.icon} {s.label}
                          </th>
                        )
                      })}
                      <th className="py-2 px-3 text-left font-bold text-blue-900 bg-blue-50/60 whitespace-nowrap">إجمالي الإيراد</th>
                      <th className="py-2 px-3 text-left font-bold text-amber-800 bg-amber-50/60 whitespace-nowrap">التجنيب (15%)</th>
                      <th className="py-2 px-3 text-left font-bold text-emerald-800 bg-emerald-50/60 whitespace-nowrap">صافي الحصيلة</th>
                    </>
                  ) : reportCategory === 'expenditures' ? (
                    <>
                      {OFFICIAL_EXPENDITURE_TYPES.map((e) => {
                        if (!visibleExpenditures[e.key]) return null
                        return (
                          <th key={e.key} className={`py-2 px-3 text-left font-bold whitespace-nowrap ${e.colorHeader}`}>
                            {e.icon} {e.label}
                          </th>
                        )
                      })}
                      <th className="py-2 px-3 text-left font-bold text-rose-800 bg-rose-50/60 whitespace-nowrap">إجمالي المنصرفات</th>
                      <th className="py-2 px-3 text-left font-bold text-emerald-800 bg-emerald-50/60 whitespace-nowrap">الفائض / العجز</th>
                    </>
                  ) : reportCategory === 'contracts' ? (
                    <>
                      {OFFICIAL_CONTRACT_TYPES.map((c) => {
                        if (!visibleContracts[c.key]) return null
                        return (
                          <th key={c.key} className={`py-2 px-3 text-left font-bold whitespace-nowrap ${c.colorHeader}`}>
                            {c.icon} {c.label}
                          </th>
                        )
                      })}
                      <th className="py-2 px-3 text-left font-bold text-blue-900 bg-blue-50/60 whitespace-nowrap">إجمالي سداد العقود</th>
                      <th className="py-2 px-3 text-left font-bold text-rose-800 bg-rose-50/60 whitespace-nowrap">إجمالي المنصرفات</th>
                    </>
                  ) : (
                    <>
                      <th className="py-2 px-3 text-left font-bold text-blue-900 whitespace-nowrap">إجمالي الإيرادات</th>
                      <th className="py-2 px-3 text-left font-bold text-rose-800 whitespace-nowrap">إجمالي المنصرفات</th>
                      <th className="py-2 px-3 text-left font-bold text-emerald-800 whitespace-nowrap">الفائض / العجز</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {paginatedData.map((row, idx) => {
                  const balance = Number(row.net_revenue || 0) - Number(row.total_expenses || 0)
                  return (
                    <tr
                      key={row.facility_id}
                      onClick={() => setSelectedFacilityForModal(row)}
                      className="hover:bg-blue-50/60 cursor-pointer transition-colors group"
                      title="انقر لفتح بطاقة الأداء المالي والتقرير التفصيلي للمنشأة"
                    >
                      {/* م - Sticky */}
                      <td className="py-2 px-2 text-center text-gray-400 font-bold whitespace-nowrap sticky right-0 bg-white group-hover:bg-blue-50/60 z-10">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>

                      {/* المنشأة الطبية - Sticky with border */}
                      <td className="py-2 px-3 font-bold text-gray-900 whitespace-nowrap sticky right-8 bg-white group-hover:bg-blue-50/60 z-10 border-l border-gray-200">
                        <div
                          className="flex items-center gap-1.5 max-w-[220px] overflow-hidden"
                          title={`${row.facility_name} (كود: ${row.facility_code} ${row.institutional_code ? `• مالي: ${row.institutional_code}` : ''})`}
                        >
                          <span className="shrink-0">{row.is_model_hospital ? '⭐' : '🏥'}</span>
                          <span className="truncate text-xs group-hover:text-blue-900 transition-colors">
                            {row.facility_name}
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono shrink-0 bg-gray-100 px-1 rounded">
                            {row.facility_code}
                          </span>
                        </div>
                      </td>

                      {/* المحافظة والمديرية */}
                      <td className="py-2 px-3 text-gray-700 whitespace-nowrap">
                        <div
                          className="flex items-center gap-1 text-[11px]"
                          title={`${row.governorate_name} - ${row.directorate_name}`}
                        >
                          <span className="font-bold text-gray-900">{row.governorate_name}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-500 truncate max-w-[110px] text-[10px]">
                            {row.directorate_name?.replace('مديرية الشئون الصحية ب', '').replace('مديرية الشئون الصحية ', '')}
                          </span>
                        </div>
                      </td>

                      {/* النوع والتصنيف */}
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          {row.is_model_hospital && (
                            <span className="badge badge-warning text-[9px] font-bold py-0.2 px-1">
                              ⭐ نموذجي
                            </span>
                          )}
                          <span className="badge badge-gray text-[9px] py-0.2 px-1.5">
                            {row.facility_type === 'hospital'
                              ? 'مستشفى'
                              : row.facility_type === 'family_health_center'
                              ? 'طب أسرة'
                              : row.facility_type === 'health_unit'
                              ? 'وحدة'
                              : 'منشأة'}
                          </span>
                        </div>
                      </td>

                      {/* Columns for Revenues */}
                      {reportCategory === 'revenue' ? (
                        <>
                          {OFFICIAL_REVENUE_SOURCES.map((s) => {
                            if (!visibleRevenues[s.id]) return null
                            const val = row.sourcesBreakdown?.[s.fullLabel] || row.sourcesBreakdown?.[s.label] || 0
                            return (
                              <td key={s.id} className={`py-2 px-2.5 text-left font-mono font-bold whitespace-nowrap ${s.colorText} ${s.colorBg}`}>
                                {val > 0 ? formatCurrency(val) : '—'}
                              </td>
                            )
                          })}
                          <td className="py-2 px-3 text-left font-mono font-bold text-blue-900 bg-blue-50/40 whitespace-nowrap">
                            {formatCurrency(row.total_revenue)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-amber-800 bg-amber-50/40 whitespace-nowrap">
                            {formatCurrency(row.total_deductions)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-emerald-800 bg-emerald-50/40 whitespace-nowrap">
                            {formatCurrency(row.net_revenue)}
                          </td>
                        </>
                      ) : reportCategory === 'expenditures' ? (
                        <>
                          {OFFICIAL_EXPENDITURE_TYPES.map((e) => {
                            if (!visibleExpenditures[e.key]) return null
                            const val = (row as any)[e.key] || 0
                            return (
                              <td key={e.key} className={`py-2 px-3 text-left font-mono font-bold whitespace-nowrap ${e.colorText} ${e.colorBg}`}>
                                {formatCurrency(val)}
                              </td>
                            )
                          })}
                          <td className="py-2 px-3 text-left font-mono font-bold text-rose-700 bg-rose-50/40 whitespace-nowrap">
                            {formatCurrency(row.total_expenses)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold bg-emerald-50/40 whitespace-nowrap">
                            <span className={balance >= 0 ? 'text-emerald-800' : 'text-rose-600'}>
                              {formatCurrency(balance)}
                            </span>
                          </td>
                        </>
                      ) : reportCategory === 'contracts' ? (
                        <>
                          {OFFICIAL_CONTRACT_TYPES.map((c) => {
                            if (!visibleContracts[c.key]) return null
                            const val = row.contractsBreakdown?.[c.key] || 0
                            return (
                              <td key={c.key} className={`py-2 px-3 text-left font-mono font-bold whitespace-nowrap ${c.colorText} ${c.colorBg}`}>
                                {val > 0 ? formatCurrency(val) : '—'}
                              </td>
                            )
                          })}
                          <td className="py-2 px-3 text-left font-mono font-bold text-blue-900 bg-blue-50/40 whitespace-nowrap">
                            {formatCurrency(row.total_contract_payments)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-rose-700 bg-rose-50/40 whitespace-nowrap">
                            {formatCurrency(row.total_expenses)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 px-3 text-left font-mono font-bold text-blue-900 bg-blue-50/20 whitespace-nowrap">
                            {formatCurrency(row.total_revenue)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-rose-700 bg-rose-50/20 whitespace-nowrap">
                            {formatCurrency(row.total_expenses)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold bg-emerald-50/20 whitespace-nowrap">
                            <span className={balance >= 0 ? 'text-emerald-800' : 'text-rose-600'}>
                              {formatCurrency(balance)}
                            </span>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {aggregationLevel === 'facility' && totalPages > 1 && (
          <div className="p-2.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-[11px]">
            <span className="text-gray-500">
              الصفحة {currentPage} من {totalPages} ({filteredData.length} منشأة)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="btn btn-outline !min-h-[28px] !py-0.5 !px-2.5 text-[11px] font-bold"
              >
                السابق
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-outline !min-h-[28px] !py-0.5 !px-2.5 text-[11px] font-bold"
              >
                التالي
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────
          5. مودال بطاقة الأداء المالي الشامل للمنشأة (360° Facility Modal)
      ───────────────────────────────────────────── */}
      {selectedFacilityForModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedFacilityForModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-blue-200 p-6 space-y-5 text-right max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-900 border border-blue-200 flex items-center justify-center text-2xl shadow-2xs shrink-0 font-bold">
                  {selectedFacilityForModal.is_model_hospital ? '⭐' : '🏥'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base sm:text-lg text-gray-900">
                      {selectedFacilityForModal.facility_name}
                    </h3>
                    {selectedFacilityForModal.is_model_hospital && (
                      <span className="badge badge-warning text-[10px] font-bold">
                        ⭐ مبادرة المستشفيات النموذجية
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    {selectedFacilityForModal.governorate_name} • {selectedFacilityForModal.directorate_name} • كود: {selectedFacilityForModal.facility_code} {selectedFacilityForModal.institutional_code ? `• مالي: ${selectedFacilityForModal.institutional_code}` : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedFacilityForModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Quick KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-center">
                <span className="text-[10px] font-bold text-blue-900 block">إجمالي الإيرادات</span>
                <span className="text-sm font-black text-blue-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityForModal.total_revenue)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-center">
                <span className="text-[10px] font-bold text-amber-900 block">مبالغ التجنيب (15%)</span>
                <span className="text-sm font-black text-amber-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityForModal.total_deductions)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[10px] font-bold text-emerald-900 block">صافي الحصيلة (85%)</span>
                <span className="text-sm font-black text-emerald-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityForModal.net_revenue)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center">
                <span className="text-[10px] font-bold text-rose-900 block">إجمالي المنصرفات</span>
                <span className="text-sm font-black text-rose-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityForModal.total_expenses)}
                </span>
              </div>
            </div>

            {/* 1. تفصيل مصادر الإيرادات الـ 8 */}
            <div className="space-y-2.5">
              <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
                <span>💰</span>
                <span>تفصيل مصادر الإيرادات الذاتية الرسمية (8 مصادر):</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {OFFICIAL_REVENUE_SOURCES.map((s) => {
                  const val =
                    selectedFacilityForModal.sourcesBreakdown?.[s.fullLabel] ||
                    selectedFacilityForModal.sourcesBreakdown?.[s.label] ||
                    0
                  return (
                    <div key={s.id} className={`p-2 rounded-xl border ${s.colorBg} border-blue-200`}>
                      <span className="text-[10px] font-bold text-gray-800 block truncate">
                        {s.icon} {s.label}
                      </span>
                      <span className={`text-xs font-black font-mono mt-0.5 block ${s.colorText}`}>
                        {val > 0 ? formatCurrency(val) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 2. تفصيل المنصرفات والتجنيب */}
            <div className="space-y-2.5 pt-1">
              <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
                <span>📉</span>
                <span>تفصيل المنصرفات المصنفة والتجنيب القانوني:</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {OFFICIAL_EXPENDITURE_TYPES.map((e) => {
                  const val = (selectedFacilityForModal as any)[e.key] || 0
                  return (
                    <div key={e.key} className={`p-2 rounded-xl border ${e.colorBg} border-rose-200`}>
                      <span className="text-[10px] font-bold text-gray-800 block truncate">
                        {e.icon} {e.label}
                      </span>
                      <span className={`text-xs font-black font-mono mt-0.5 block ${e.colorText}`}>
                        {val > 0 ? formatCurrency(val) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 3. تفصيل تصنيف العقود والخدمات الـ 5 */}
            <div className="space-y-2.5 pt-1">
              <h4 className="font-bold text-xs text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-1.5">
                <span>📑</span>
                <span>تفصيل عقود الخدمات المسددة (5 عقود مصنفة):</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {OFFICIAL_CONTRACT_TYPES.map((c) => {
                  const val = selectedFacilityForModal.contractsBreakdown?.[c.key] || 0
                  return (
                    <div key={c.key} className={`p-2 rounded-xl border ${c.colorBg} border-indigo-200`}>
                      <span className="text-[10px] font-bold text-gray-800 block truncate">
                        {c.icon} {c.label}
                      </span>
                      <span className={`text-xs font-black font-mono mt-0.5 block ${c.colorText}`}>
                        {val > 0 ? formatCurrency(val) : '—'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
              <span className="text-gray-500 font-mono text-[11px]">
                الفترة: {reportType === 'monthly' ? formatMonthArabic(selectedMonth) : `السنة المالية ${selectedFiscalYear}`}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-outline !min-h-[32px] !py-1 text-xs font-bold"
                >
                  🖨️ طباعة بطاقة المنشأة
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFacilityForModal(null)}
                  className="btn btn-primary !min-h-[32px] !py-1 text-xs font-bold !px-5"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
