'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormField } from '@/components/ui/FormField'
import { FormSelect } from '@/components/ui/FormSelect'
import {
  FACILITY_TYPE_LABELS,
  AFFILIATION_LABELS,
  type FacilityType,
  type AffiliationType,
} from '@/lib/constants'
import * as XLSX from 'xlsx'

interface Governorate {
  id: string
  name: string
  code: string
  display_order?: number
}

interface Directorate {
  id: string
  name: string
  code: string
  governorate_id: string
}

interface Administration {
  id: string
  name: string
  code: string
  directorate_id: string
}

interface Facility {
  id: string
  name: string
  code: string
  institutional_code: string | null
  facility_type: FacilityType
  is_model_hospital: boolean
  affiliation: AffiliationType
  directorate_id: string
  administration_id?: string | null
  health_directorates?: {
    name: string
    code?: string
    governorates?: {
      id?: string
      name: string
      code?: string
    }
  }
  health_administrations?: {
    name: string
    code?: string
  }
}

export default function FacilitiesManagementPage() {
  const supabase = createClient()

  const [governorates, setGovernorates] = useState<Governorate[]>([])
  const [directorates, setDirectorates] = useState<Directorate[]>([])
  const [administrations, setAdministrations] = useState<Administration[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)

  // Add Form state
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    governorate_id: '',
    directorate_id: '',
    administration_id: '',
    affiliation: 'directorate' as AffiliationType,
    name: '',
    code: '',
    institutional_code: '',
    facility_type: 'hospital' as FacilityType,
    is_model_hospital: true,
  })

  // Edit Modal state
  const [editFacility, setEditFacility] = useState<Facility | null>(null)
  const [editFormData, setEditFormData] = useState({
    governorate_id: '',
    directorate_id: '',
    administration_id: '',
    affiliation: 'directorate' as AffiliationType,
    name: '',
    code: '',
    institutional_code: '',
    facility_type: 'hospital' as FacilityType,
    is_model_hospital: false,
  })

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterGov, setFilterGov] = useState('all')
  const [filterAffiliation, setFilterAffiliation] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterModelOnly, setFilterModelOnly] = useState(false)

  // Load all hierarchy data
  async function loadData() {
    setLoading(true)
    try {
      const { data: govs } = await supabase.from('governorates').select('*').order('display_order')
      const { data: dirs } = await supabase.from('health_directorates').select('*').order('name')
      
      let adminsData: any[] = []
      try {
        const { data: adms } = await supabase.from('health_administrations').select('*').order('name')
        if (adms) adminsData = adms
      } catch (e) {
        console.warn('health_administrations table not yet loaded:', e)
      }

      const { data: facs } = await supabase
        .from('facilities')
        .select(`
          *,
          health_directorates (
            name,
            code,
            governorates ( id, name, code )
          )
        `)
        .order('name')

      if (govs) setGovernorates(govs)
      if (dirs) setDirectorates(dirs)
      setAdministrations(adminsData)
      if (facs) setFacilities(facs as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filter directorates based on selected governorate in add form
  const availableDirectorates = directorates.filter(
    (d) => !formData.governorate_id || d.governorate_id === formData.governorate_id
  )

  // Filter directorates based on selected governorate in edit form
  const editAvailableDirectorates = directorates.filter(
    (d) => !editFormData.governorate_id || d.governorate_id === editFormData.governorate_id
  )

  // Handle Add Facility
  async function handleAddFacility(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setSubmitting(true)

    try {
      const { error } = await supabase.from('facilities').insert({
        directorate_id: formData.directorate_id,
        administration_id: formData.administration_id || null,
        affiliation: formData.affiliation,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        institutional_code: formData.institutional_code.trim() || null,
        facility_type: formData.facility_type,
        is_model_hospital: formData.is_model_hospital,
      })

      if (error) throw error

      setSuccessMsg('تمت إضافة المنشأة الطبية بالهيكل المعتمد بنجاح!')
      setShowAddModal(false)
      setFormData({
        governorate_id: '',
        directorate_id: '',
        administration_id: '',
        affiliation: 'directorate',
        name: '',
        code: '',
        institutional_code: '',
        facility_type: 'hospital',
        is_model_hospital: true,
      })
      await loadData()
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء إضافة المنشأة')
    } finally {
      setSubmitting(false)
    }
  }

  // Open Edit Modal
  function handleOpenEdit(fac: Facility) {
    setEditFacility(fac)
    setErrorMsg('')
    const govId = fac.health_directorates?.governorates?.id || ''
    setEditFormData({
      governorate_id: govId,
      directorate_id: fac.directorate_id || '',
      administration_id: fac.administration_id || '',
      affiliation: fac.affiliation || 'directorate',
      name: fac.name || '',
      code: fac.code || '',
      institutional_code: fac.institutional_code || '',
      facility_type: fac.facility_type || 'hospital',
      is_model_hospital: fac.is_model_hospital ?? false,
    })
  }

  // Handle Update Facility
  async function handleUpdateFacility(e: React.FormEvent) {
    e.preventDefault()
    if (!editFacility) return
    setErrorMsg('')
    setSuccessMsg('')
    setSubmitting(true)

    try {
      const { error } = await supabase
        .from('facilities')
        .update({
          directorate_id: editFormData.directorate_id,
          administration_id: editFormData.administration_id || null,
          affiliation: editFormData.affiliation,
          name: editFormData.name.trim(),
          code: editFormData.code.trim().toUpperCase(),
          institutional_code: editFormData.institutional_code.trim() || null,
          facility_type: editFormData.facility_type,
          is_model_hospital: editFormData.is_model_hospital,
        })
        .eq('id', editFacility.id)

      if (error) throw error

      setSuccessMsg(`تم تحديث بيانات المنشأة (${editFormData.name}) بنجاح!`)
      setEditFacility(null)
      await loadData()
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء تحديث المنشأة')
    } finally {
      setSubmitting(false)
    }
  }

  // Quick Toggle Model Hospital
  async function handleToggleModelHospital(fac: Facility) {
    try {
      const newVal = !fac.is_model_hospital
      const { error } = await supabase
        .from('facilities')
        .update({ is_model_hospital: newVal })
        .eq('id', fac.id)

      if (error) throw error

      setFacilities((prev) =>
        prev.map((f) => (f.id === fac.id ? { ...f, is_model_hospital: newVal } : f))
      )
    } catch (err: any) {
      alert('حدث خطأ أثناء تحديث حالة المنشأة: ' + err.message)
    }
  }

  // Handle Excel Upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data: any[] = XLSX.utils.sheet_to_json(ws)

        if (!data || data.length === 0) {
          alert('الملف فارغ أو بتنسيق غير صحيح')
          return
        }

        let successCount = 0
        let errorCount = 0

        for (const row of data) {
          const dirCode = row['كود المديرية'] || row['كود الإدارة'] || 'DIR-CAI'
          const facName = row['اسم المنشأة']
          const facCode = row['كود النظام'] || row['كود المنشأة']
          const instCode = row['الكود المؤسسي']
          const facType = row['نوع المنشأة'] || 'hospital'
          const isModel = row['مستشفى نموذجي (نعم/لا)'] === 'نعم' || row['مستشفى نموذجي'] === true || row['is_model_hospital'] === true
          const affil = row['التبعية'] || 'directorate'

          if (!facName || !facCode) continue

          const dir = directorates.find((d) => d.code === dirCode)
          const dirId = dir ? dir.id : directorates[0]?.id

          if (!dirId) continue

          const { error } = await supabase.from('facilities').upsert(
            {
              directorate_id: dirId,
              name: String(facName).trim(),
              code: String(facCode).trim().toUpperCase(),
              institutional_code: instCode ? String(instCode).trim() : null,
              facility_type: facType,
              is_model_hospital: isModel,
              affiliation: affil,
            },
            { onConflict: 'code' }
          )

          if (error) errorCount++
          else successCount++
        }

        alert(`اكتمل الاستيراد: تم حفظ ${successCount} منشأة بنجاح (${errorCount} أخطاء).`)
        await loadData()
      } catch (err) {
        console.error(err)
        alert('حدث خطأ أثناء قراءة ملف الإكسيل')
      }
    }
    reader.readAsBinaryString(file)
  }

  // Comprehensive 3-Sheet Official Excel Template
  function downloadTemplate() {
    const wb = XLSX.utils.book_new()

    // 1. شيت بيان المنشآت
    const facilitiesSheetData = [
      {
        'اسم المنشأة': 'مستشفى 15 مايو التخصصي (نموذجي)',
        'كود النظام': 'CAI01',
        'الكود المؤسسي': '101001',
        'كود المديرية': 'DIR-CAI',
        'المحافظة': 'القاهرة',
        'التبعية': 'directorate',
        'نوع المنشأة': 'hospital',
        'مستشفى نموذجي (نعم/لا)': 'نعم',
      },
      {
        'اسم المنشأة': 'مركز طب أسرة السيدة زينب',
        'كود النظام': 'U-CAI01',
        'الكود المؤسسي': '881001',
        'كود المديرية': 'DIR-CAI',
        'المحافظة': 'القاهرة',
        'التبعية': 'directorate',
        'نوع المنشأة': 'family_health_center',
        'مستشفى نموذجي (نعم/لا)': 'لا',
      },
      {
        'اسم المنشأة': 'معهد ناصر للبحوث والعلاج',
        'كود النظام': 'AMT-NASSER',
        'الكود المؤسسي': '101099',
        'كود المديرية': 'AMT-NAT',
        'المحافظة': 'القاهرة',
        'التبعية': 'specialized_centers_secretariat',
        'نوع المنشأة': 'specialized_center',
        'مستشفى نموذجي (نعم/لا)': 'نعم',
      },
    ]
    const ws1 = XLSX.utils.json_to_sheet(facilitiesSheetData)
    ws1['!cols'] = [{ wch: 35 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 22 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'بيان المنشآت والهيكل')

    // 2. شيت استمارة الإدخال المالي الشهري
    const financialEntryData = [
      {
        'كود المنشأة': 'CAI01',
        'اسم المنشأة': 'مستشفى 15 مايو التخصصي',
        'الشهر المالي (YYYY-MM-01)': '2026-08-01',
        'العلاج بأجر': 250000,
        'الشهادات والتقارير': 15000,
        'زيارة المرضى': 20000,
        'التبرعات والهبات': 50000,
        'نفقة الدولة': 400000,
        'التأمين الصحي': 300000,
        'شركات خاصة ومظلات': 100000,
        'موارد أخرى': 10000,
        'تجنيب مستحقات العاملين': 120000,
        'تجنيب الأدوية والمستلزمات': 180000,
        'فواتير الشراء الموحد': 90000,
        'سداد عقود التشغيل والصيانة': 45000,
      },
    ]
    const ws2 = XLSX.utils.json_to_sheet(financialEntryData)
    ws2['!cols'] = [{ wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'استمارة القيد المالي الشهري')

    // 3. شيت القوائم المرجعية للمحافظات والمديريات
    const lookupsData = governorates.map((g, idx) => {
      const dir = directorates.find((d) => d.governorate_id === g.id)
      return {
        'م': idx + 1,
        'اسم المحافظة': g.name,
        'كود المحافظة': g.code,
        'المديرية التابعة': dir?.name || `مديرية الشئون الصحية بـ ${g.name}`,
        'كود المديرية الرسمي': dir?.code || `DIR-${g.code}`,
      }
    })
    const ws3 = XLSX.utils.json_to_sheet(lookupsData)
    ws3['!cols'] = [{ wch: 6 }, { wch: 20 }, { wch: 14 }, { wch: 35 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'دليل المحافظات والمديريات')

    XLSX.writeFile(wb, 'نموذج_الهيكل_الصحي_والقيد_المالي_المعتمد.xlsx')
  }

  // Filter facilities
  const filteredFacilities = facilities.filter((fac) => {
    const matchesSearch =
      fac.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fac.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (fac.institutional_code && fac.institutional_code.includes(searchQuery))

    const matchesGov =
      filterGov === 'all' ||
      fac.health_directorates?.governorates?.name === filterGov

    const matchesAffiliation =
      filterAffiliation === 'all' || fac.affiliation === filterAffiliation

    const matchesType =
      filterType === 'all' || fac.facility_type === filterType

    const matchesModel = !filterModelOnly || fac.is_model_hospital === true

    return matchesSearch && matchesGov && matchesAffiliation && matchesType && matchesModel
  })

  // Statistics
  const totalCount = facilities.length
  const modelCount = facilities.filter((f) => f.is_model_hospital).length
  const specializedCount = facilities.filter((f) => f.affiliation === 'specialized_centers_secretariat').length
  const unitsCount = facilities.filter((f) => f.facility_type === 'health_unit' || f.facility_type === 'family_health_center').length

  return (
    <div className="space-y-6">
      {/* Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title text-xl sm:text-2xl font-black text-[var(--color-text)] flex items-center gap-2">
            <span>🏛️</span>
            <span>قائمة المنشآت</span>
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-muted)] mt-1">
            دليل المنشآت الصحية، التبعية، المحافظات، ومبادرة المستشفيات النموذجية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={downloadTemplate}
            className="btn btn-outline !min-h-[38px] !py-1.5 text-xs font-bold flex items-center gap-1.5 border-emerald-500 text-emerald-800 hover:bg-emerald-50"
          >
            <span>📥</span>
            <span>تحميل نموذج Excel المعتمد (3 شيتات)</span>
          </button>

          <label className="btn btn-outline !min-h-[38px] !py-1.5 text-xs font-bold cursor-pointer border-blue-400 text-blue-800 hover:bg-blue-50">
            <span>📤</span>
            <span>رفع وتحديث المنشآت من Excel</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary !min-h-[38px] !py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <span>➕</span>
            <span>إضافة منشأة بالهيكل الجديد</span>
          </button>
        </div>
      </div>

      {successMsg && <div className="alert-success">✓ {successMsg}</div>}

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3.5 bg-gradient-to-br from-blue-50 to-indigo-50/40 border border-blue-200">
          <span className="text-[11px] font-bold text-blue-900 block">إجمالي المنشآت المسجلة</span>
          <span className="text-xl font-black text-[var(--color-primary)] font-mono mt-0.5 block">
            {totalCount}
          </span>
          <span className="text-[10px] text-gray-500">عبر محافظات الجمهورية الـ 27</span>
        </div>

        <div className="card p-3.5 bg-gradient-to-br from-amber-50 to-orange-50/40 border border-amber-300">
          <span className="text-[11px] font-bold text-amber-950 block">⭐ مبادرة المستشفيات النموذجية</span>
          <span className="text-xl font-black text-amber-900 font-mono mt-0.5 block">
            {modelCount}
          </span>
          <span className="text-[10px] text-amber-800/80">مستشفيات مميزة بالأداء المعياري</span>
        </div>

        <div className="card p-3.5 bg-gradient-to-br from-purple-50 to-fuchsia-50/40 border border-purple-200">
          <span className="text-[11px] font-bold text-purple-950 block">🏥 أمانة المراكز المتخصصة</span>
          <span className="text-xl font-black text-purple-900 font-mono mt-0.5 block">
            {specializedCount}
          </span>
          <span className="text-[10px] text-purple-800/80">مستشفيات ومراكز تخصصية</span>
        </div>

        <div className="card p-3.5 bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200">
          <span className="text-[11px] font-bold text-emerald-950 block">🩺 الوحدات ومراكز طب الأسرة</span>
          <span className="text-xl font-black text-emerald-800 font-mono mt-0.5 block">
            {unitsCount}
          </span>
          <span className="text-[10px] text-emerald-800/80">رعاية أولية وطب أسرة</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card !p-4 bg-white border border-gray-200 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label className="form-label text-xs mb-1 font-bold">بحث بالاسم أو الكود:</label>
            <input
              type="text"
              placeholder="اسم المنشأة أو الكود المؤسسي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input !min-h-[36px] !py-1 text-xs"
            />
          </div>

          {/* Governorate */}
          <div>
            <label className="form-label text-xs mb-1 font-bold">المحافظة (الـ 27 محافظة):</label>
            <select
              value={filterGov}
              onChange={(e) => setFilterGov(e.target.value)}
              className="form-input !min-h-[36px] !py-1 text-xs"
            >
              <option value="all">جميع المحافظات (27)</option>
              {governorates.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name} ({g.code})
                </option>
              ))}
            </select>
          </div>

          {/* Affiliation */}
          <div>
            <label className="form-label text-xs mb-1 font-bold">التبعية الإدارية:</label>
            <select
              value={filterAffiliation}
              onChange={(e) => setFilterAffiliation(e.target.value)}
              className="form-input !min-h-[36px] !py-1 text-xs"
            >
              <option value="all">جميع جهات التبعية</option>
              {Object.entries(AFFILIATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* Facility Type */}
          <div>
            <label className="form-label text-xs mb-1 font-bold">نوع المنشأة:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="form-input !min-h-[36px] !py-1 text-xs"
            >
              <option value="all">جميع أنواع المنشآت</option>
              {Object.entries(FACILITY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Checkbox: Model Hospitals Only */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-amber-900 bg-amber-50/80 px-3 py-1.5 rounded-xl border border-amber-200">
            <input
              type="checkbox"
              checked={filterModelOnly}
              onChange={(e) => setFilterModelOnly(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
            />
            <span>⭐ عرض منشآت مبادرة فخامة رئيس الجمهورية للمستشفيات النموذجية فقط ({modelCount})</span>
          </label>

          <span className="text-xs text-gray-500 font-mono">
            {filteredFacilities.length} منشأة مطابقة
          </span>
        </div>
      </div>

      {/* Facilities Table */}
      <div className="card shadow-sm border border-[var(--color-border)] !p-0 overflow-hidden">
        <div className="table-wrapper">
          <table className="table w-full text-xs">
            <thead>
              <tr className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                <th className="py-3 px-3 text-center w-12">م</th>
                <th className="py-3 px-4 text-right">اسم المنشأة الطبية</th>
                <th className="py-3 px-4 text-right">التبعية والمديرية</th>
                <th className="py-3 px-4 text-right">المحافظة</th>
                <th className="py-3 px-4 text-center">نوع المنشأة</th>
                <th className="py-3 px-4 text-center">كود النظام</th>
                <th className="py-3 px-4 text-center">الكود المؤسسي</th>
                <th className="py-3 px-4 text-center">المستشفيات النموذجية</th>
                <th className="py-3 px-4 text-center w-28">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    <div className="w-8 h-8 border-3 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">جاري تحميل المنشآت والهيكل...</p>
                  </td>
                </tr>
              ) : filteredFacilities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    لا توجد منشآت تطابق معايير البحث والفلترة
                  </td>
                </tr>
              ) : (
                filteredFacilities.map((fac, idx) => (
                  <tr key={fac.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-3 px-3 text-center text-gray-500 font-bold">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-gray-900">
                      <div className="flex items-center gap-1.5">
                        <span>{fac.is_model_hospital ? '⭐' : fac.facility_type === 'hospital' ? '🏥' : '🩺'}</span>
                        <span>{fac.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      <div>
                        <span className="font-semibold text-blue-900 block">
                          {fac.health_directorates?.name || 'مديرية الشئون الصحية'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {AFFILIATION_LABELS[fac.affiliation] || 'مديرية الشئون الصحية'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-gray-800">
                      {fac.health_directorates?.governorates?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="badge badge-info text-[10px]">
                        {FACILITY_TYPE_LABELS[fac.facility_type] || fac.facility_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-gray-800">
                      {fac.code}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-blue-700">
                      {fac.institutional_code || '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleModelHospital(fac)}
                        title="انقر لتفعيل أو إلغاء تصنيف المستشفى النموذجي"
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                          fac.is_model_hospital
                            ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 shadow-2xs'
                            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        <span>⭐</span>
                        <span>{fac.is_model_hospital ? 'نموذجي (مفعل)' : 'غير مصنف'}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(fac)}
                        className="btn btn-outline !min-h-[28px] !py-0.5 !px-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 border-blue-300 flex items-center justify-center gap-1 mx-auto"
                      >
                        <span>✏️</span>
                        <span>تعديل</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          مودال إضافة منشأة جديدة بالهيكل الشامل
      ───────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-blue-200 p-6 space-y-5 text-right max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-800 border border-blue-200 flex items-center justify-center text-2xl shadow-xs shrink-0">
                  🏥
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                    إضافة منشأة طبية جديدة بالهيكل التنظيمي المعتمد
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    الربط بالمحافظة، المديرية/الأمانة، الإدارة الصحية، وتحديد صفة المستشفى النموذجي
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {errorMsg && <div className="alert-error">⚠️ {errorMsg}</div>}

            <form onSubmit={handleAddFacility} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* المحافظة */}
                <div>
                  <label className="form-label text-xs font-bold">المحافظة (الـ 27 محافظة) *</label>
                  <select
                    required
                    value={formData.governorate_id}
                    onChange={(e) => {
                      const gId = e.target.value
                      const defaultDir = directorates.find((d) => d.governorate_id === gId)
                      setFormData({
                        ...formData,
                        governorate_id: gId,
                        directorate_id: defaultDir ? defaultDir.id : '',
                      })
                    }}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    <option value="">اختر المحافظة...</option>
                    {governorates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* التبعية الإدارية */}
                <div>
                  <label className="form-label text-xs font-bold">الجهة والتبعية الإدارية *</label>
                  <select
                    required
                    value={formData.affiliation}
                    onChange={(e) => setFormData({ ...formData, affiliation: e.target.value as AffiliationType })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    {Object.entries(AFFILIATION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* المديرية / الأمانة */}
                <div>
                  <label className="form-label text-xs font-bold">المديرية أو الأمانة التابعة *</label>
                  <select
                    required
                    value={formData.directorate_id}
                    onChange={(e) => setFormData({ ...formData, directorate_id: e.target.value })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    <option value="">اختر المديرية...</option>
                    {availableDirectorates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* نوع المنشأة */}
                <div>
                  <label className="form-label text-xs font-bold">نوع المنشأة الطبية *</label>
                  <select
                    required
                    value={formData.facility_type}
                    onChange={(e) => setFormData({ ...formData, facility_type: e.target.value as FacilityType })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    {Object.entries(FACILITY_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* اسم المنشأة */}
                <div className="sm:col-span-2">
                  <label className="form-label text-xs font-bold">اسم المنشأة الطبية الرسمي *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مستشفى عين شمس العام، مركز طب أسرة..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  />
                </div>

                {/* كود النظام الداخلي */}
                <div>
                  <label className="form-label text-xs font-bold">كود النظام الداخلي (Code) *</label>
                  <input
                    type="text"
                    required
                    placeholder="CAI99"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="form-input font-mono font-bold text-xs uppercase !min-h-[38px]"
                    dir="ltr"
                  />
                </div>

                {/* الكود المؤسسي الرسمي */}
                <div>
                  <label className="form-label text-xs font-bold">الكود المؤسسي بوزارة المالية</label>
                  <input
                    type="text"
                    placeholder="102030"
                    value={formData.institutional_code}
                    onChange={(e) => setFormData({ ...formData, institutional_code: e.target.value })}
                    className="form-input font-mono font-bold text-xs !min-h-[38px]"
                    dir="ltr"
                  />
                </div>

                {/* مبادرة المستشفيات النموذجية */}
                <div className="sm:col-span-2 p-3 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-2xs">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.is_model_hospital}
                      onChange={(e) => setFormData({ ...formData, is_model_hospital: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-extrabold text-xs text-amber-950 block">
                        ⭐ تصنيف المنشأة ضمن "مبادرة فخامة رئيس الجمهورية للمستشفيات النموذجية"
                      </span>
                      <span className="text-[10px] text-amber-800/90">
                        يتم تمييز المستشفى بشارة الأداء النموذجي وإدراجها في تقارير المتابعة النوعية الرئاسية
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-ghost text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs font-bold !px-6"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ المنشأة 💾'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          مودال تعديل منشأة قائمة (Edit Facility Modal)
      ───────────────────────────────────────────── */}
      {editFacility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => setEditFacility(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-blue-200 p-6 space-y-5 text-right max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center text-2xl shadow-xs shrink-0">
                  ✏️
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 leading-snug">
                    تعديل بيانات المنشأة الطبية والهيكل
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5 font-mono">
                    الكود: {editFacility.code} • ID: {editFacility.id.slice(0, 8)}...
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditFacility(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold transition-all"
              >
                ✕
              </button>
            </div>

            {errorMsg && <div className="alert-error">⚠️ {errorMsg}</div>}

            <form onSubmit={handleUpdateFacility} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* المحافظة */}
                <div>
                  <label className="form-label text-xs font-bold">المحافظة *</label>
                  <select
                    required
                    value={editFormData.governorate_id}
                    onChange={(e) => {
                      const gId = e.target.value
                      const defaultDir = directorates.find((d) => d.governorate_id === gId)
                      setEditFormData({
                        ...editFormData,
                        governorate_id: gId,
                        directorate_id: defaultDir ? defaultDir.id : '',
                      })
                    }}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    <option value="">اختر المحافظة...</option>
                    {governorates.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* التبعية الإدارية */}
                <div>
                  <label className="form-label text-xs font-bold">الجهة والتبعية الإدارية *</label>
                  <select
                    required
                    value={editFormData.affiliation}
                    onChange={(e) => setEditFormData({ ...editFormData, affiliation: e.target.value as AffiliationType })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    {Object.entries(AFFILIATION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* المديرية / الأمانة */}
                <div>
                  <label className="form-label text-xs font-bold">المديرية أو الأمانة التابعة *</label>
                  <select
                    required
                    value={editFormData.directorate_id}
                    onChange={(e) => setEditFormData({ ...editFormData, directorate_id: e.target.value })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    <option value="">اختر المديرية...</option>
                    {editAvailableDirectorates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* نوع المنشأة */}
                <div>
                  <label className="form-label text-xs font-bold">نوع المنشأة الطبية *</label>
                  <select
                    required
                    value={editFormData.facility_type}
                    onChange={(e) => setEditFormData({ ...editFormData, facility_type: e.target.value as FacilityType })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  >
                    {Object.entries(FACILITY_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* اسم المنشأة */}
                <div className="sm:col-span-2">
                  <label className="form-label text-xs font-bold">اسم المنشأة الطبية الرسمي *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="form-input text-xs font-bold !min-h-[38px]"
                  />
                </div>

                {/* كود النظام الداخلي */}
                <div>
                  <label className="form-label text-xs font-bold">كود النظام الداخلي (Code) *</label>
                  <input
                    type="text"
                    required
                    value={editFormData.code}
                    onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value })}
                    className="form-input font-mono font-bold text-xs uppercase !min-h-[38px]"
                    dir="ltr"
                  />
                </div>

                {/* الكود المؤسسي الرسمي */}
                <div>
                  <label className="form-label text-xs font-bold">الكود المؤسسي بوزارة المالية</label>
                  <input
                    type="text"
                    placeholder="102030"
                    value={editFormData.institutional_code}
                    onChange={(e) => setEditFormData({ ...editFormData, institutional_code: e.target.value })}
                    className="form-input font-mono font-bold text-xs !min-h-[38px]"
                    dir="ltr"
                  />
                </div>

                {/* مبادرة المستشفيات النموذجية */}
                <div className="sm:col-span-2 p-3 rounded-2xl bg-amber-50/90 border border-amber-300 shadow-2xs">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editFormData.is_model_hospital}
                      onChange={(e) => setEditFormData({ ...editFormData, is_model_hospital: e.target.checked })}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
                    />
                    <div>
                      <span className="font-extrabold text-xs text-amber-950 block">
                        ⭐ تصنيف المنشأة ضمن "مبادرة فخامة رئيس الجمهورية للمستشفيات النموذجية"
                      </span>
                      <span className="text-[10px] text-amber-800/90">
                        يتم تمييز المستشفى بشارة الأداء النموذجي وإدراجها في تقارير المتابعة النوعية الرئاسية
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditFacility(null)}
                  className="btn btn-ghost text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary text-xs font-bold !px-6"
                >
                  {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات 💾'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
