'use client'

import React, { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FormField } from './FormField'
import { FormSelect } from './FormSelect'

interface AdjustmentModalProps {
  isOpen: boolean
  onClose: () => void
  facilityId: string
  facilityName: string
  month: string
  recordType: 'revenue' | 'deduction' | 'procurement' | 'contract_payment'
  originalRecordId?: string | null
  originalRefNumber?: string | null
  onSuccess: () => void
}

export function AdjustmentModal({
  isOpen,
  onClose,
  facilityId,
  facilityName,
  month,
  recordType,
  originalRecordId,
  originalRefNumber,
  onSuccess,
}: AdjustmentModalProps) {
  const supabase = createClient()
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease' | 'correction'>('increase')
  const [amount, setAmount] = useState<string>('')
  const [reason, setReason] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const getRecordTypeLabel = () => {
    switch (recordType) {
      case 'revenue': return 'إيراد'
      case 'deduction': return 'استقطاع / تجنيب'
      case 'procurement': return 'أمر شراء (أدوية/مستلزمات)'
      case 'contract_payment': return 'سداد عقد'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount === 0) {
      setError('يرجى إدخال قيمة تسوية صحيحة (لا تساوي صفر)')
      return
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setError('يرجى كتابة سبب التسوية بالتفصيل (5 أحرف على الأقل مع ذكر رقم السند)')
      return
    }

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

      // القيمة النهائية بحسب نوع التسوية
      const finalAmount = adjustmentType === 'decrease' ? -Math.abs(numAmount) : Math.abs(numAmount)

      const { error: insertErr } = await supabase
        .from('financial_adjustments')
        .insert({
          facility_id: facilityId,
          month: month,
          record_type: recordType,
          original_record_id: originalRecordId || null,
          original_ref_number: originalRefNumber || null,
          adjustment_type: adjustmentType,
          amount: finalAmount,
          reason: reason.trim(),
          created_by: user.id,
        })

      if (insertErr) throw insertErr

      onSuccess()
      onClose()
    } catch (err: any) {
      console.error('Error creating financial adjustment:', err)
      setError(err.message || 'حدث خطأ أثناء حفظ التسوية المالية')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200">
        {/* Header */}
        <div className="bg-[#1E5AA8] text-white p-5 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span>⚖️</span>
              إجراء تسوية مالية رسمية
            </h3>
            <p className="text-xs text-blue-100 mt-1">
              تصحيح معتمد لشهر مقفل — {facilityName} ({month})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white text-2xl leading-none p-1"
          >
            &times;
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-right">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <span>⚠️</span>
              {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <span>📌</span> تنبيه نظام الحسابات الحكومية:
            </p>
            <p>
              نظراً لإقفال هذا الشهر المالي، لا يتم تعديل الأرقام الأصلية. سيتم تقييد هذا التعديل كسجل تسوية مالي منفصل يحمل رقماً مرجعياً خاصاً ويوثق في سجل التدقيق المالي.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">نوع المعاملة</label>
              <input
                type="text"
                value={getRecordTypeLabel()}
                disabled
                className="w-full bg-gray-100 text-gray-700 border border-gray-300 rounded-lg p-2 text-sm"
              />
            </div>
            {originalRefNumber && (
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">الرقم المرجعي الأصلي</label>
                <input
                  type="text"
                  value={originalRefNumber}
                  disabled
                  className="w-full bg-gray-100 font-mono text-gray-700 border border-gray-300 rounded-lg p-2 text-xs"
                />
              </div>
            )}
          </div>

          <FormSelect
            label="نوع التسوية"
            value={adjustmentType}
            onChange={(e) => setAdjustmentType(e.target.value as any)}
            options={[
              { value: 'increase', label: 'زيادة مالية (+)' },
              { value: 'decrease', label: 'تخفيض مالي (-)' },
              { value: 'correction', label: 'تسوية وإعادة تصنيف' },
            ]}
          />

          <FormField
            label="قيمة التسوية (ج.م)"
            type="number"
            step="0.01"
            required
            placeholder="مثال: 5000.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-700 block">
              سبب التسوية والسند الرسمي <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="اكتب بالتفصيل سبب التسوية (مثال: فروق فواتير معتمدة بناءً على إذن تسوية رقم 123...)"
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-[#1E5AA8] focus:border-transparent outline-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold text-white bg-[#1E5AA8] hover:bg-[#164584] rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <span className="animate-spin text-xs">⏳</span>}
              اعتماد وترحيل التسوية
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
