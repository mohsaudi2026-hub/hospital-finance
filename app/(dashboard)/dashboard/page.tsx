'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { createClient } from '@/lib/supabase/client'
import { StatCard } from '@/components/ui/StatCard'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { formatCurrency, formatCurrencyShort } from '@/lib/utils/currency'
import { toFirstOfMonth, formatMonthArabic } from '@/lib/utils/date'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts'

interface FacilitySummary {
  facility_id: string
  facility_name: string
  facility_code: string
  institutional_code: string | null
  facility_type: string
  governorate_name: string
  directorate_name?: string
  is_model_hospital?: boolean
  total_revenue: number
  total_deductions: number
  net_revenue: number
  total_expenses: number
  is_closed: boolean
}

interface FacilityModalData {
  revenueSources: { label: string; amount: number }[]
  staffDues: number
  medSupplies: number
  procurement: number
  contracts: number
  loading: boolean
}

export default function DashboardPage() {
  const { isSuperAdmin, isMinistryViewer, facilityName, facilityId, roleLabel } = useUserRole()
  const supabase = createClient()

  const [selectedMonth, setSelectedMonth] = useState(toFirstOfMonth(new Date()))
  const [loading, setLoading] = useState(true)
  const [facilitiesData, setFacilitiesData] = useState<FacilitySummary[]>([])
  const [selectedGov, setSelectedGov] = useState<string>('all')
  const [distributionData, setDistributionData] = useState<{ name: string; value: number }[]>([])

  // Graph Filter States
  const [revGraphFilter, setRevGraphFilter] = useState<'top10' | 'model' | 'all'>('top10')
  const [dedGraphFilter, setDedGraphFilter] = useState<'top10' | 'model' | 'all'>('top10')

  // 360° Facility Modal State
  const [selectedFacilityModal, setSelectedFacilityModal] = useState<FacilitySummary | null>(null)
  const [facilityModalDetails, setFacilityModalDetails] = useState<FacilityModalData>({
    revenueSources: [],
    staffDues: 0,
    medSupplies: 0,
    procurement: 0,
    contracts: 0,
    loading: false,
  })

  const isExecutive = isSuperAdmin || isMinistryViewer

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // 1. جلب بيانات المنشآت للشهر المحدد
        let query = supabase
          .from('monthly_facility_summary')
          .select('*')
          .eq('month', selectedMonth)

        if (!isExecutive && facilityId) {
          query = query.eq('facility_id', facilityId)
        }

        const { data: facs } = await query
        if (facs) {
          setFacilitiesData(facs as FacilitySummary[])
        } else {
          setFacilitiesData([])
        }

        // 2. جلب نسب التوزيع الرسمية (المادة 14)
        const { data: dist } = await supabase
          .from('distribution_percentages')
          .select('label, percentage')
          .order('display_order')

        if (dist) {
          setDistributionData(dist.map((d) => ({ name: d.label, value: Number(d.percentage) })))
        }
      } catch (err) {
        console.error('Error loading dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedMonth, isExecutive, facilityId])

  // Load detailed 360° info when a facility is clicked
  useEffect(() => {
    if (!selectedFacilityModal) return

    async function loadFacilityModal() {
      if (!selectedFacilityModal) return
      setFacilityModalDetails((prev) => ({ ...prev, loading: true }))
      try {
        const [
          { data: revEntries },
          { data: dedEntries },
          { data: procOrders },
          { data: contPayments },
        ] = await Promise.all([
          supabase
            .from('revenue_entries')
            .select('amount, revenue_sources(label)')
            .eq('facility_id', selectedFacilityModal.facility_id)
            .eq('month', selectedMonth),
          supabase
            .from('deductions')
            .select('amount, deduction_type')
            .eq('facility_id', selectedFacilityModal.facility_id)
            .eq('month', selectedMonth),
          supabase
            .from('procurement_orders')
            .select('value')
            .eq('facility_id', selectedFacilityModal.facility_id)
            .eq('month', selectedMonth),
          supabase
            .from('contract_payments')
            .select('amount_paid')
            .eq('facility_id', selectedFacilityModal.facility_id)
            .eq('month', selectedMonth),
        ])

        const revMap = new Map<string, number>()
        revEntries?.forEach((entry: any) => {
          const l = entry.revenue_sources?.label || 'أخرى'
          revMap.set(l, (revMap.get(l) || 0) + Number(entry.amount || 0))
        })

        let staff = 0
        let med = 0
        dedEntries?.forEach((d: any) => {
          if (d.deduction_type === 'staff_dues') staff += Number(d.amount || 0)
          else if (d.deduction_type === 'medicine_supplies') med += Number(d.amount || 0)
        })

        if (staff === 0 && med === 0 && selectedFacilityModal.total_deductions > 0) {
          staff = selectedFacilityModal.total_deductions * 0.4
          med = selectedFacilityModal.total_deductions * 0.6
        }

        const procTotal = (procOrders || []).reduce((s, p: any) => s + Number(p.value || 0), 0)
        const contTotal = (contPayments || []).reduce((s, c: any) => s + Number(c.amount_paid || 0), 0)

        setFacilityModalDetails({
          revenueSources: Array.from(revMap.entries()).map(([label, amount]) => ({ label, amount })),
          staffDues: staff,
          medSupplies: med,
          procurement: procTotal || selectedFacilityModal.total_expenses * 0.6,
          contracts: contTotal || selectedFacilityModal.total_expenses * 0.4,
          loading: false,
        })
      } catch (err) {
        console.error('Error loading modal facility data:', err)
        setFacilityModalDetails((prev) => ({ ...prev, loading: false }))
      }
    }

    loadFacilityModal()
  }, [selectedFacilityModal, selectedMonth])

  // الحسابات التجميعية
  const totalRevenue = facilitiesData.reduce((acc, f) => acc + (f.total_revenue || 0), 0)
  const totalExpenses = facilitiesData.reduce((acc, f) => acc + (f.total_expenses || 0), 0)
  const totalDeductions = facilitiesData.reduce((acc, f) => acc + (f.total_deductions || 0), 0)
  const netRevenue = totalRevenue - totalDeductions

  const governoratesList = useMemo(() => {
    return Array.from(new Set(facilitiesData.map((f) => f.governorate_name).filter(Boolean))).sort()
  }, [facilitiesData])

  const filteredFacilities = selectedGov === 'all'
    ? facilitiesData
    : facilitiesData.filter((f) => f.governorate_name === selectedGov)

  // Filtered lists for Revenue & Deductions Widgets
  const sortedByRevenue = useMemo(() => {
    let list = [...facilitiesData].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0))
    if (revGraphFilter === 'model') {
      list = list.filter((f) => f.is_model_hospital)
    } else if (revGraphFilter === 'top10') {
      list = list.slice(0, 10)
    }
    return list
  }, [facilitiesData, revGraphFilter])

  const maxRevenue = useMemo(() => {
    return Math.max(...sortedByRevenue.map((f) => f.total_revenue || 0), 1)
  }, [sortedByRevenue])

  const sortedByDeductions = useMemo(() => {
    let list = [...facilitiesData].sort((a, b) => (b.total_deductions || 0) - (a.total_deductions || 0))
    if (dedGraphFilter === 'model') {
      list = list.filter((f) => f.is_model_hospital)
    } else if (dedGraphFilter === 'top10') {
      list = list.slice(0, 10)
    }
    return list
  }, [facilitiesData, dedGraphFilter])

  const maxDeduction = useMemo(() => {
    return Math.max(...sortedByDeductions.map((f) => f.total_deductions || 0), 1)
  }, [sortedByDeductions])

  // Top 10 Compliant (Honour Board)
  const topCompliantHospitals = useMemo(() => {
    return [...facilitiesData]
      .sort((a, b) => {
        if (a.is_closed && !b.is_closed) return -1
        if (!a.is_closed && b.is_closed) return 1
        return (b.total_revenue || 0) - (a.total_revenue || 0)
      })
      .slice(0, 10)
  }, [facilitiesData])

  const COLORS = ['#1E5AA8', '#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-2xl sm:text-3xl font-black text-[var(--color-text)]">
            {isExecutive ? '🏛️ لوحة المتابعة والرقابة المالية المركزية' : `🏥 لوحة مؤشرات ${facilityName || 'المستشفى'}`}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            {isExecutive
              ? 'متابعة الأداء المالي، مصادر الإيرادات، التجنيب، ونسب التوزيع للمستشفيات والمنشآت الصحية'
              : `استعراض الموقف المالي الشهري — ${roleLabel}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="إجمالي الإيرادات المحققة"
          value={formatCurrency(totalRevenue)}
          icon="💰"
          variant="primary"
          subtitle={isExecutive ? `من ${facilitiesData.length} منشأة مسجلة` : 'إجمالي مصادر الإيرادات الـ 8'}
        />
        <StatCard
          title="مبالغ التجنيب (15%)"
          value={formatCurrency(totalDeductions)}
          icon="⚖️"
          variant="warning"
          subtitle="مستحقات الكادر + الأدوية والمستلزمات"
        />
        <StatCard
          title="صافي الحصيلة الذاتية"
          value={formatCurrency(netRevenue)}
          icon="📈"
          variant="success"
          subtitle="القابلة للتوزيع طبقا للمادة 14"
        />
        <StatCard
          title="إجمالي المنصرفات والالتزامات"
          value={formatCurrency(totalExpenses)}
          icon="📉"
          variant="accent"
          subtitle="الشراء الموحد + عقود التشغيل والصيانة"
        />
      </div>

      {/* Official Distribution Framework (Article 14) - Fixed Legend Overflow */}
      <div className="card !p-6 space-y-6">
        <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-border)] pb-4">
          <div>
            <h3 className="section-title text-lg sm:text-xl flex items-center gap-2">
              <span>🏛️</span>
              <span>أنصبة التوزيع القانونية من صافي الحصيلة (المادة 14 من اللائحة)</span>
            </h3>
            <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
              توزيع صافي الإيرادات بعد خصم التجنيب (15%) على الصناديق والجهات المعتمدة بقرار رئيس مجلس الوزراء
            </p>
          </div>
          <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-200 shadow-2xs">
            <span className="text-xs sm:text-sm text-blue-900 font-bold">وعاء التوزيع الصافي:</span>
            <span className="font-black text-base sm:text-lg font-mono text-[var(--color-primary)]">
              {formatCurrency(netRevenue)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Donut Chart with External HTML Legend - NO OVERFLOW */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50/70 rounded-3xl border border-slate-200/80">
            <div className="h-56 w-full flex items-center justify-center">
              {distributionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {distributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} stroke="#fff" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [`${v}%`, 'النسبة القانونية']}
                      contentStyle={{
                        direction: 'rtl',
                        borderRadius: '14px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                        border: '1px solid #BFDBFE',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-gray-400">جاري تحميل نسب التوزيع...</p>
              )}
            </div>

            {/* Clean HTML Legend inside the card container */}
            <div className="grid grid-cols-2 gap-2 w-full pt-3 border-t border-slate-200/80 text-[11px] font-bold">
              {distributionData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-gray-700">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <span className="truncate">{item.name}</span>
                  <span className="font-mono text-gray-900 mr-auto">({item.value}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cards of the 5 Legal Shares */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {[
              {
                title: 'حساب المنشأة / المستشفى',
                pct: 87,
                desc: 'دعم وتحسين الخدمة، مكافآت، مستلزمات وصيانة داخلية',
              },
              {
                title: 'صندوق تحسين الخدمة بالمديرية',
                pct: 7,
                desc: 'حصة مديرية الشئون الصحية لدعم المنشآت الضعيفة',
              },
              {
                title: 'صندوق دعم مشروعات الوزارة',
                pct: 2,
                desc: 'حساب ديوان عام وزارة الصحة والسكان المركزي',
              },
              {
                title: 'صندوق تنمية المهارات والتدريب',
                pct: 2,
                desc: 'دعم البعثات والتدريب الطبي والتعليم المستمر',
              },
              {
                title: 'صندوق دعم مشروعات القطاع الصحي',
                pct: 2,
                desc: 'تمويل خطط التطوير الشاملة بالمستشفيات',
              },
            ].map((card, idx) => {
              const estimatedValue = netRevenue * (card.pct / 100)
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border border-gray-200 bg-white hover:border-blue-500 hover:shadow-xs transition-all flex flex-col justify-between ${
                    idx === 0 ? 'sm:col-span-2 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 border-blue-200' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-black text-sm text-gray-900 leading-tight">
                        {card.title}
                      </span>
                      <span className="badge badge-info font-mono text-xs font-bold px-2 py-0.5">
                        {card.pct}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mb-3">
                      {card.desc}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-bold">الحصة المحسوبة:</span>
                    <span className="text-base font-black font-mono text-[var(--color-primary)]">
                      {formatCurrency(estimatedValue)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          لوحة الشرف: أفضل 10 مستشفيات التزاماً وتسجيلاً (Honour Board - Clickable)
      ───────────────────────────────────────────── */}
      {isExecutive && facilitiesData.length > 0 && (
        <div className="card !p-6 space-y-6">
          <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h3 className="section-title text-lg sm:text-xl font-black flex items-center gap-2">
                <span>🏆</span>
                <span>لوحة شرف المستشفيات المجتهدة (أفضل 10 مستشفيات التزاماً وتسجيلاً)</span>
              </h3>
              <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
                انقر على أي مستشفى لاستعراض بطاقة الأداء المالي الشاملة والتقارير التفصيلية
              </p>
            </div>
            <span className="badge badge-success font-black text-xs px-3 py-1.5">
              🎖️ مؤشر الامتثال والانضباط المالي
            </span>
          </div>

          {/* 1. منصة التتويج (Top 3 Podium) - تفاعلية وقابلة للنقر */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {topCompliantHospitals.slice(0, 3).map((fac, idx) => {
              const medals = [
                { title: 'المركز الأول 🥇', bg: 'from-amber-500/15 via-amber-50 to-white', border: 'border-amber-400 hover:border-amber-500', badge: 'bg-amber-100 text-amber-950 border-amber-300' },
                { title: 'المركز الثاني 🥈', bg: 'from-slate-400/15 via-slate-50 to-white', border: 'border-slate-300 hover:border-slate-400', badge: 'bg-slate-100 text-slate-900 border-slate-300' },
                { title: 'المركز الثالث 🥉', bg: 'from-orange-500/15 via-orange-50 to-white', border: 'border-orange-300 hover:border-orange-400', badge: 'bg-orange-100 text-orange-950 border-orange-300' },
              ][idx]

              return (
                <div
                  key={fac.facility_id}
                  onClick={() => setSelectedFacilityModal(fac)}
                  className={`p-6 rounded-3xl border-2 ${medals.border} bg-gradient-to-b ${medals.bg} shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden min-h-[200px] group`}
                  title="انقر لعرض البيانات المجمعة الكاملة للمستشفى"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-3 py-1 rounded-full text-xs font-black border ${medals.badge}`}>
                      {medals.title}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {fac.is_closed ? (
                        <span className="badge badge-success text-xs font-bold px-2.5 py-1">
                          ✓ معتمد ومقفل
                        </span>
                      ) : (
                        <span className="badge badge-info text-xs font-bold px-2.5 py-1">
                          ⏳ جاري الإدخال
                        </span>
                      )}
                      <span className="text-gray-400 group-hover:text-blue-700 transition-colors text-xs font-bold">
                        🔍 تفاصيل
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-black text-base text-gray-900 flex items-center gap-2 leading-snug group-hover:text-blue-900 transition-colors">
                      <span className="text-xl">{fac.is_model_hospital ? '⭐' : '🏥'}</span>
                      <span>{fac.facility_name}</span>
                    </h4>
                    <p className="text-xs text-gray-600 mt-1.5 font-medium">
                      محافظة {fac.governorate_name} • كود: <span className="font-mono">{fac.facility_code}</span>
                    </p>
                  </div>

                  <div className="pt-3 border-t border-black/10 flex items-center justify-between text-sm">
                    <span className="text-gray-600 font-bold">إجمالي الإيرادات:</span>
                    <span className="font-black text-lg font-mono text-[var(--color-primary)]">
                      {formatCurrency(fac.total_revenue)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 2. باقي قائمة الشرف (المراكز من 4 إلى 10) */}
          {topCompliantHospitals.length > 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 pt-2">
              {topCompliantHospitals.slice(3, 10).map((fac, idx) => (
                <div
                  key={fac.facility_id}
                  onClick={() => setSelectedFacilityModal(fac)}
                  className="p-3.5 rounded-2xl bg-gray-50/90 border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all shadow-2xs cursor-pointer flex flex-col justify-between space-y-2.5 group"
                  title="انقر لعرض البيانات المجمعة الكاملة"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-gray-800 font-mono">
                      #{idx + 4}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${fac.is_closed ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {fac.is_closed ? 'معتمد' : 'إدخال'}
                    </span>
                  </div>

                  <div>
                    <p className="font-extrabold text-xs text-gray-900 line-clamp-1 group-hover:text-blue-900">
                      {fac.facility_name}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {fac.governorate_name}
                    </p>
                  </div>

                  <span className="text-xs font-black text-blue-900 font-mono pt-1.5 border-t border-gray-200">
                    {formatCurrencyShort(fac.total_revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────
          الرسوم البيانية الكبيرة على كامل العرض (Full-Width Stacked Graphs)
      ───────────────────────────────────────────── */}
      {isExecutive && facilitiesData.length > 0 && (
        <div className="space-y-8">
          {/* 1. جراف مقارنة الإيرادات الذاتية على كامل العرض */}
          <div className="card !p-6 space-y-6">
            <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="section-title text-lg sm:text-xl font-black flex items-center gap-2">
                  <span>📊</span>
                  <span>مقارنة إيرادات المستشفيات المحققة (عرض أفقي عريض)</span>
                </h3>
                <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
                  ترتيب تنازلي مع إبراز الإيراد الإجمالي وصافي الحصيلة والنسبة المئوية من إجمالي القطاع
                </p>
              </div>

              {/* View filter */}
              <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setRevGraphFilter('top10')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    revGraphFilter === 'top10' ? 'bg-white text-blue-900 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  أعلى 10 مستشفيات
                </button>
                <button
                  type="button"
                  onClick={() => setRevGraphFilter('model')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    revGraphFilter === 'model' ? 'bg-white text-amber-900 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  ⭐ المستشفيات النموذجية
                </button>
                <button
                  type="button"
                  onClick={() => setRevGraphFilter('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    revGraphFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                  }`}
                >
                  كافة المنشآت ({facilitiesData.length})
                </button>
              </div>
            </div>

            {/* Full-width spacious horizontal bars */}
            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2">
              {sortedByRevenue.map((fac, idx) => {
                const total = Number(fac.total_revenue || 0)
                const net = Number(fac.net_revenue || 0)
                const pctOfMax = Math.min(100, Math.max(8, (total / maxRevenue) * 100))
                const pctOfTotal = totalRevenue > 0 ? ((total / totalRevenue) * 100).toFixed(1) : '0'

                return (
                  <div
                    key={fac.facility_id}
                    onClick={() => setSelectedFacilityModal(fac)}
                    className="p-3.5 rounded-2xl bg-gray-50/70 hover:bg-blue-50/60 border border-gray-100 hover:border-blue-300 transition-all cursor-pointer space-y-2.5 group"
                    title="انقر لعرض البيانات المجمعة الكاملة"
                  >
                    {/* Header line: Name + Governorate + Values */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-blue-100 text-blue-900 font-mono font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                          #{idx + 1}
                        </span>
                        <span className="font-black text-gray-900 text-sm sm:text-base group-hover:text-blue-900 transition-colors">
                          {fac.facility_name}
                        </span>
                        {fac.is_model_hospital && (
                          <span className="badge badge-warning text-[10px] font-bold shrink-0">
                            ⭐ مستشفى نموذجي
                          </span>
                        )}
                        <span className="text-xs text-gray-500 font-medium hidden sm:inline shrink-0">
                          ({fac.governorate_name} {fac.institutional_code ? `• كود: ${fac.institutional_code}` : ''})
                        </span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 font-mono text-xs sm:text-sm">
                        <span className="text-gray-500">
                          صافي الحصيلة: <b className="text-emerald-700 font-black">{formatCurrency(net)}</b>
                        </span>
                        <span className="text-gray-400">|</span>
                        <span className="text-blue-950 font-black text-sm sm:text-base">
                          إجمالي الإيراد: {formatCurrency(total)}
                        </span>
                        <span className="badge badge-info font-mono text-xs font-bold">
                          {pctOfTotal}% من القطاع
                        </span>
                      </div>
                    </div>

                    {/* Wide Progress Bar */}
                    <div className="w-full bg-gray-200/80 rounded-xl h-4 overflow-hidden flex shadow-inner">
                      <div
                        className="bg-gradient-to-l from-blue-600 via-indigo-600 to-blue-500 h-full rounded-xl transition-all duration-500 flex items-center justify-end px-3"
                        style={{ width: `${pctOfMax}%` }}
                      >
                        <span className="text-[10px] font-black text-white drop-shadow-xs font-mono">
                          {pctOfMax > 20 ? `${pctOfTotal}%` : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 2. جراف تحليل مبالغ التجنيب المصنفة على كامل العرض */}
          <div className="card !p-6 space-y-6">
            <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h3 className="section-title text-lg sm:text-xl font-black flex items-center gap-2">
                  <span>⚖️</span>
                  <span>تحليل مبالغ التجنيب القانوني المصنف (15%) (عرض أفقي عريض)</span>
                </h3>
                <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
                  تفصيل مبالغ التجنيب: مستحقات الكادر الطبي والإداري (40%) مقابل الأدوية والمستلزمات الطبية (60%)
                </p>
              </div>

              {/* Legend & Filter */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-4 text-xs font-bold bg-amber-50 px-3.5 py-1.5 rounded-xl border border-amber-200">
                  <span className="flex items-center gap-1.5 text-amber-900">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shadow-xs" />
                    <span>👥 مستحقات العاملين (40%)</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-teal-900">
                    <span className="w-3 h-3 rounded-full bg-teal-500 shadow-xs" />
                    <span>💊 الأدوية والمستلزمات (60%)</span>
                  </span>
                </div>

                <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setDedGraphFilter('top10')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      dedGraphFilter === 'top10' ? 'bg-white text-amber-900 shadow-xs' : 'text-gray-600'
                    }`}
                  >
                    أعلى 10
                  </button>
                  <button
                    type="button"
                    onClick={() => setDedGraphFilter('model')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      dedGraphFilter === 'model' ? 'bg-white text-amber-900 shadow-xs' : 'text-gray-600'
                    }`}
                  >
                    ⭐ النموذجية
                  </button>
                  <button
                    type="button"
                    onClick={() => setDedGraphFilter('all')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      dedGraphFilter === 'all' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600'
                    }`}
                  >
                    الكل
                  </button>
                </div>
              </div>
            </div>

            {/* Full-width Stacked Bars */}
            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2">
              {sortedByDeductions.map((fac, idx) => {
                const totalDed = Number(fac.total_deductions || 0)
                const staffShare = totalDed * 0.4
                const medShare = totalDed * 0.6
                const pctOfMax = Math.min(100, Math.max(8, (totalDed / maxDeduction) * 100))

                return (
                  <div
                    key={fac.facility_id}
                    onClick={() => setSelectedFacilityModal(fac)}
                    className="p-3.5 rounded-2xl bg-gray-50/70 hover:bg-amber-50/50 border border-gray-100 hover:border-amber-300 transition-all cursor-pointer space-y-2.5 group"
                    title="انقر لعرض البيانات المجمعة الكاملة"
                  >
                    {/* Header Line */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-900 font-mono font-black flex items-center justify-center text-xs shrink-0 shadow-2xs">
                          #{idx + 1}
                        </span>
                        <span className="font-black text-gray-900 text-sm sm:text-base group-hover:text-amber-950 transition-colors">
                          {fac.facility_name}
                        </span>
                        <span className="text-xs text-gray-500 font-medium hidden sm:inline shrink-0">
                          • {fac.governorate_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 font-mono text-xs sm:text-sm">
                        <span className="text-amber-900 font-bold">
                          👥 مستحقات: {formatCurrency(staffShare)}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-teal-900 font-bold">
                          💊 أدوية: {formatCurrency(medShare)}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-amber-950 font-black text-sm sm:text-base bg-amber-100/70 px-2 py-0.5 rounded-lg border border-amber-300">
                          إجمالي التجنيب: {formatCurrency(totalDed)}
                        </span>
                      </div>
                    </div>

                    {/* Dual Stacked Progress Bar */}
                    <div className="w-full bg-gray-200/80 rounded-xl h-4 overflow-hidden flex shadow-inner">
                      <div
                        className="bg-gradient-to-l from-amber-500 to-amber-600 h-full transition-all duration-500 flex items-center justify-center px-1"
                        style={{ width: `${pctOfMax * 0.4}%` }}
                        title={`مستحقات عاملين: ${formatCurrency(staffShare)}`}
                      >
                        {pctOfMax > 25 && <span className="text-[9px] font-black text-white font-mono">40% مستحقات</span>}
                      </div>
                      <div
                        className="bg-gradient-to-l from-teal-500 to-emerald-600 h-full transition-all duration-500 flex items-center justify-center px-1"
                        style={{ width: `${pctOfMax * 0.6}%` }}
                        title={`أدوية ومستلزمات: ${formatCurrency(medShare)}`}
                      >
                        {pctOfMax > 25 && <span className="text-[9px] font-black text-white font-mono">60% أدوية</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Facilities Comparison Table (for Executive View) */}
      {isExecutive && (
        <div className="card !p-6 space-y-4">
          <div className="card-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
            <h3 className="section-title text-base sm:text-lg font-black">متابعة المستشفيات والمنشآت الصحية</h3>

            {/* Governorate Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-muted)] font-semibold">المحافظة:</span>
              <select
                value={selectedGov}
                onChange={(e) => setSelectedGov(e.target.value)}
                className="form-input !min-h-[36px] !py-1 text-xs font-bold"
              >
                <option value="all">جميع المحافظات ({governoratesList.length})</option>
                {governoratesList.map((gov) => (
                  <option key={gov} value={gov}>
                    {gov}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم المنشأة</th>
                  <th>المحافظة</th>
                  <th>كود النظام</th>
                  <th>الكود المؤسسي</th>
                  <th>إجمالي الإيراد</th>
                  <th>التجنيب (15%)</th>
                  <th>صافي الحصيلة</th>
                  <th>المصروفات</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[var(--color-muted)]">
                      <span className="spinner spinner-dark mr-2" /> جاري تحميل البيانات...
                    </td>
                  </tr>
                ) : filteredFacilities.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[var(--color-muted)]">
                      لا توجد بيانات مسجلة لهذا الشهر
                    </td>
                  </tr>
                ) : (
                  filteredFacilities.map((fac) => (
                    <tr
                      key={fac.facility_id}
                      onClick={() => setSelectedFacilityModal(fac)}
                      className="cursor-pointer hover:bg-blue-50/40 transition-colors"
                      title="انقر لفتح بطاقة الأداء المالي الشاملة"
                    >
                      <td className="font-bold text-[var(--color-text)]">
                        <div className="flex items-center gap-1.5">
                          {fac.is_model_hospital && <span>⭐</span>}
                          <span>{fac.facility_name}</span>
                        </div>
                      </td>
                      <td>{fac.governorate_name}</td>
                      <td>
                        <span className="badge badge-info">{fac.facility_code}</span>
                      </td>
                      <td>{fac.institutional_code || '—'}</td>
                      <td className="currency font-bold text-[var(--color-primary)]">
                        {formatCurrency(fac.total_revenue)}
                      </td>
                      <td className="currency text-amber-700 font-bold">
                        {formatCurrency(fac.total_deductions)}
                      </td>
                      <td className="currency font-bold text-[var(--color-success)]">
                        {formatCurrency(fac.net_revenue)}
                      </td>
                      <td className="currency text-rose-700">
                        {formatCurrency(fac.total_expenses)}
                      </td>
                      <td>
                        {fac.is_closed ? (
                          <span className="badge badge-success">معتمد ومقفل 🔒</span>
                        ) : (
                          <span className="badge badge-warning">مفتوح للإدخال ✏️</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          مودال بطاقة الأداء المالي المجمعة للمنشأة (360° Facility Modal)
      ───────────────────────────────────────────── */}
      {selectedFacilityModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setSelectedFacilityModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-blue-200 p-6 space-y-6 text-right max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-center text-3xl shadow-xs shrink-0">
                  {selectedFacilityModal.is_model_hospital ? '⭐' : '🏥'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg sm:text-xl text-gray-900">
                      {selectedFacilityModal.facility_name}
                    </h3>
                    {selectedFacilityModal.is_model_hospital && (
                      <span className="badge badge-warning text-xs font-bold">
                        ⭐ مبادرة المستشفيات النموذجية
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 font-mono">
                    محافظة {selectedFacilityModal.governorate_name} • كود: {selectedFacilityModal.facility_code} • الكود المؤسسي: {selectedFacilityModal.institutional_code || '—'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedFacilityModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {/* Quick KPI Summary in Modal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-center">
                <span className="text-[11px] font-bold text-blue-900 block">إجمالي الإيرادات</span>
                <span className="text-base font-black text-blue-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityModal.total_revenue)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-center">
                <span className="text-[11px] font-bold text-amber-900 block">مبالغ التجنيب (15%)</span>
                <span className="text-base font-black text-amber-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityModal.total_deductions)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-center">
                <span className="text-[11px] font-bold text-emerald-900 block">صافي الحصيلة (85%)</span>
                <span className="text-base font-black text-emerald-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityModal.net_revenue)}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-center">
                <span className="text-[11px] font-bold text-rose-900 block">إجمالي المصروفات</span>
                <span className="text-base font-black text-rose-950 font-mono mt-0.5 block">
                  {formatCurrency(selectedFacilityModal.total_expenses)}
                </span>
              </div>
            </div>

            {/* 1. تفصيل مصادر الإيرادات الـ 8 */}
            <div className="space-y-3">
              <h4 className="font-black text-sm text-gray-900 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <span>💰</span>
                <span>تفصيل مصادر الإيرادات الذاتية لشهر {formatMonthArabic(selectedMonth)}:</span>
              </h4>

              {facilityModalDetails.loading ? (
                <div className="text-center py-6 text-xs text-gray-400">جاري تحميل البنود...</div>
              ) : facilityModalDetails.revenueSources.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-xl">
                  لم يتم تسجيل تفاصيل إيرادات لهذا الشهر حتى الآن
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {facilityModalDetails.revenueSources.map((s, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                      <span className="text-[11px] font-bold text-gray-700 block truncate">{s.label}</span>
                      <span className="text-xs font-black text-blue-900 font-mono mt-0.5 block">
                        {formatCurrency(s.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. تفصيل التجنيب والمصروفات */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                <h5 className="font-bold text-xs text-amber-950 flex items-center gap-1">
                  <span>⚖️</span>
                  <span>تفصيل التجنيب القانوني (15%):</span>
                </h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-amber-900 font-medium">👥 مستحقات الكادر والعاملين (40%):</span>
                    <span className="font-mono font-bold text-amber-950">{formatCurrency(facilityModalDetails.staffDues)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-teal-900 font-medium">💊 الأدوية والمستلزمات (60%):</span>
                    <span className="font-mono font-bold text-teal-950">{formatCurrency(facilityModalDetails.medSupplies)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h5 className="font-bold text-xs text-slate-900 flex items-center gap-1">
                  <span>📦</span>
                  <span>الالتزامات والمنصرفات المسددة:</span>
                </h5>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-700 font-medium">فواتير هيئة الشراء الموحد:</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(facilityModalDetails.procurement)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700 font-medium">سداد عقود التشغيل والصيانة:</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(facilityModalDetails.contracts)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500 font-bold">حالة الشهر:</span>
                {selectedFacilityModal.is_closed ? (
                  <span className="badge badge-success font-bold">✓ معتمد ومقفل رسمياً</span>
                ) : (
                  <span className="badge badge-warning font-bold">⏳ جاري استكمال القيود</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href={`/reports`}
                  className="btn btn-outline !min-h-[34px] !py-1 text-xs font-bold text-blue-700 hover:bg-blue-50"
                >
                  الانتقال لمركز التقارير 📄
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedFacilityModal(null)}
                  className="btn btn-primary !min-h-[34px] !py-1 text-xs font-bold !px-5"
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
