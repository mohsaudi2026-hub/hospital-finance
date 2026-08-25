'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { FormField } from '@/components/ui/FormField'
import { FormSelect } from '@/components/ui/FormSelect'
import { CONTRACT_TYPE_LABELS, type ContractType } from '@/lib/constants'
import { formatCurrency } from '@/lib/utils/currency'

interface Facility {
  id: string
  name: string
  code: string
}

export default function NewContractPage() {
  const router = useRouter()
  const supabase = createClient()
  const { isSuperAdmin, facilityId } = useUserRole()

  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [formData, setFormData] = useState({
    contract_type: 'security' as ContractType,
    company_name: '',
    start_date: new Date().toISOString().split('T')[0],
    duration_months: '12',
    individual_value: '',
    supervisor_value: '0',
    total_individuals: '',
    total_supervisors: '0',
    total_contract_value: '',
  })

  useEffect(() => {
    async function init() {
      if (isSuperAdmin) {
        const { data } = await supabase.from('facilities').select('id, name, code').order('name')
        if (data) {
          setFacilities(data)
          if (data.length > 0) setSelectedFacilityId(data[0].id)
        }
      } else if (facilityId) {
        setSelectedFacilityId(facilityId)
      }
    }
    init()
  }, [isSuperAdmin, facilityId])

  const isLaborContract = formData.contract_type === 'security' || formData.contract_type === 'cleaning'

  // الحساب التلقائي لإجمالي العقد المقترح (لعقود العمالة: أمن ونظافة)
  const calculatedTotal = isLaborContract
    ? ((parseFloat(formData.individual_value) || 0) * (parseInt(formData.total_individuals) || 0) +
        (parseFloat(formData.supervisor_value) || 0) * (parseInt(formData.total_supervisors) || 0)) *
      (parseInt(formData.duration_months) || 0)
    : 0

  // تحديث الإجمالي تلقائياً إذا لم يتم كتابته يدوياً لعقود العمالة
  useEffect(() => {
    if (isLaborContract && calculatedTotal > 0) {
      setFormData((prev) => ({
        ...prev,
        total_contract_value: String(calculatedTotal),
      }))
    }
  }, [
    isLaborContract,
    calculatedTotal,
    formData.individual_value,
    formData.total_individuals,
    formData.supervisor_value,
    formData.total_supervisors,
    formData.duration_months,
  ])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFacilityId) return
    setErrorMsg('')
    setSubmitting(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

      const totalVal = parseFloat(formData.total_contract_value)
      if (totalVal <= 0 || isNaN(totalVal)) throw new Error('قيمة العقد يجب أن تكون أكبر من الصفر')

      const { error } = await supabase.from('contracts').insert({
        facility_id: selectedFacilityId,
        contract_type: formData.contract_type,
        company_name: formData.company_name.trim(),
        start_date: formData.start_date,
        duration_months: parseInt(formData.duration_months) || 12,
        individual_value: parseFloat(formData.individual_value) || 0,
        supervisor_value: parseFloat(formData.supervisor_value) || 0,
        total_individuals: parseInt(formData.total_individuals) || 0,
        total_supervisors: parseInt(formData.total_supervisors) || 0,
        total_contract_value: totalVal,
        created_by: user.id,
      })

      if (error) throw error

      router.push('/contracts')
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ العقد')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">تأسيس عقد خدمة جديد</h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            تسجيل بيانات العقد وحساب الإجمالي المقترح مع إمكانية التعديل للمطابقة الرسمية
          </p>
        </div>
        <Link href="/contracts" className="btn btn-ghost !min-h-[36px] !py-1 text-xs">
          ← عودة للعقود
        </Link>
      </div>

      {errorMsg && <div className="alert-error">⚠️ {errorMsg}</div>}

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Facility for Super Admin */}
          {isSuperAdmin && facilities.length > 0 && (
            <FormSelect
              label="المنشأة الصحية"
              required
              options={facilities.map((f) => ({ value: f.id, label: `${f.name} (${f.code})` }))}
              value={selectedFacilityId}
              onChange={(e) => setSelectedFacilityId(e.target.value)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="نوع العقد"
              required
              options={Object.entries(CONTRACT_TYPE_LABELS).map(([k, v]) => ({
                value: k,
                label: v,
              }))}
              value={formData.contract_type}
              onChange={(e) =>
                setFormData({ ...formData, contract_type: e.target.value as ContractType })
              }
            />

            <FormField
              label="اسم الشركة / المقاول"
              required
              placeholder="مثال: شركة النصر للحراسة والخدمات"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="تاريخ بداية العقد"
              type="date"
              required
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />

            <FormField
              label="مدة العقد (بالشهور)"
              type="number"
              min="1"
              required
              placeholder="12"
              value={formData.duration_months}
              onChange={(e) => setFormData({ ...formData, duration_months: e.target.value })}
            />
          </div>

          {/* Breakdown Section — يظهر فقط لعقود الأمن والنظافة (العمالة والأفراد) */}
          {isLaborContract && (
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-blue-950">
                  تفصيل الأفراد والمشرفين (لحساب القيمة المقترحة)
                </h4>
                <span className="badge badge-info text-[10px] font-bold">
                  عقد عمالة ({CONTRACT_TYPE_LABELS[formData.contract_type]})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="عدد الأفراد / العمال"
                  type="number"
                  min="0"
                  required
                  placeholder="مثال: 10"
                  value={formData.total_individuals}
                  onChange={(e) => setFormData({ ...formData, total_individuals: e.target.value })}
                />

                <FormField
                  label="قيمة الفرد الواحد شهرياً (ج.م)"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                  value={formData.individual_value}
                  onChange={(e) => setFormData({ ...formData, individual_value: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  label="عدد المشرفين"
                  type="number"
                  min="0"
                  placeholder="مثال: 1 (اختياري)"
                  value={formData.total_supervisors}
                  onChange={(e) => setFormData({ ...formData, total_supervisors: e.target.value })}
                />

                <FormField
                  label="قيمة المشرف شهرياً (ج.م)"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00 (اختياري)"
                  value={formData.supervisor_value}
                  onChange={(e) => setFormData({ ...formData, supervisor_value: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Total Value with auto-calc and manual override */}
          <div className="p-4 rounded-xl bg-gray-50 border border-[var(--color-border)] space-y-2">
            <div className="flex items-center justify-between">
              <label className="form-label font-bold text-sm">
                إجمالي قيمة العقد النهائي (ج.م) <span className="required">*</span>
              </label>
              {isLaborContract && calculatedTotal > 0 && (
                <span className="text-xs text-[var(--color-muted)]">
                  المحسوب آلياً: <b>{formatCurrency(calculatedTotal)}</b>
                </span>
              )}
            </div>

            <FormField
              label=""
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={formData.total_contract_value}
              onChange={(e) => setFormData({ ...formData, total_contract_value: e.target.value })}
              className="text-lg font-bold text-[var(--color-primary)]"
              hint={
                isLaborContract
                  ? 'يمكنك تعديل الإجمالي يدوياً ليطابق نص العقد الرسمي تماماً'
                  : 'أدخل القيمة الإجمالية للعقد المعتمدة من واقع مستندات التعاقد'
              }
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
            <Link href="/contracts" className="btn btn-ghost">
              إلغاء
            </Link>
            <button
              type="submit"
              disabled={submitting || !formData.company_name || !formData.total_contract_value}
              className="btn btn-primary min-w-[160px]"
            >
              {submitting ? 'جاري الحفظ...' : 'حفظ العقد 💾'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
