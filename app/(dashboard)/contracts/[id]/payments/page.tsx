'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useUserRole } from '@/lib/hooks/useUserRole'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { FormField } from '@/components/ui/FormField'
import { formatCurrency } from '@/lib/utils/currency'
import { toFirstOfMonth } from '@/lib/utils/date'
import { CONTRACT_TYPE_LABELS, type ContractType } from '@/lib/constants'

interface Contract {
  id: string
  facility_id: string
  contract_type: ContractType
  company_name: string
  start_date: string
  duration_months: number
  total_contract_value: number
  facilities?: { name: string; code: string }
}

interface Payment {
  id: string
  month: string
  amount_paid: number
  notes: string | null
  ref_number: string | null
  created_at: string
}

export default function ContractPaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = use(params)
  const contractId = resolvedParams.id
  const supabase = createClient()
  const { canEditFinancials } = useUserRole()

  const [contract, setContract] = useState<Contract | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [selectedMonth, setSelectedMonth] = useState(toFirstOfMonth(new Date()))
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isClosed, setIsClosed] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function loadData() {
    setLoading(true)
    try {
      // 1. جلب بيانات العقد
      const { data: cData } = await supabase
        .from('contracts')
        .select('*, facilities(name, code)')
        .eq('id', contractId)
        .single()

      if (cData) {
        setContract(cData as any)

        // التحقق من إغلاق الشهر للمنشأة
        const { data: closure } = await supabase
          .from('monthly_closures')
          .select('id')
          .eq('facility_id', cData.facility_id)
          .eq('month', selectedMonth)
          .maybeSingle()

        setIsClosed(!!closure)
      }

      // 2. جلب كل السدادات السابقة
      const { data: pData } = await supabase
        .from('contract_payments')
        .select('*')
        .eq('contract_id', contractId)
        .order('month', { ascending: false })

      if (pData) setPayments(pData as any)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [contractId, selectedMonth])

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0)
  const remaining = (contract?.total_contract_value || 0) - totalPaid
  const nextCumulative = totalPaid + (parseFloat(amount) || 0)
  const willExceedContract = contract && nextCumulative > contract.total_contract_value

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault()
    if (!contract) return
    setSaving(true)
    setMsg(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('يرجى تسجيل الدخول أولاً')

      const numAmount = parseFloat(amount)
      if (numAmount <= 0 || isNaN(numAmount)) throw new Error('مبلغ السداد يجب أن يكون أكبر من الصفر')

      const { error } = await supabase.from('contract_payments').upsert(
        {
          contract_id: contract.id,
          facility_id: contract.facility_id,
          month: selectedMonth,
          amount_paid: numAmount,
          notes: notes || null,
          created_by: user.id,
        },
        { onConflict: 'contract_id,month' }
      )

      if (error) throw error

      setMsg({ type: 'success', text: 'تم تسجيل السداد الشهري وتوليد الرقم المرجعي بنجاح!' })
      setAmount('')
      setNotes('')
      await loadData()
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء تسجيل السداد' })
    } finally {
      setSaving(false)
    }
  }

  if (loading && !contract) {
    return (
      <div className="text-center py-16 text-[var(--color-muted)]">
        <span className="spinner spinner-dark mr-2" /> جاري تحميل تفاصيل العقد...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">السداد الشهري للعقد</h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            تسجيل الدفعات الشهرية مع المتابعة التراكمية لقيمة العقد
          </p>
        </div>
        <Link href="/contracts" className="btn btn-ghost !min-h-[36px] !py-1 text-xs">
          ← عودة لقائمة العقود
        </Link>
      </div>

      {/* Contract Details Header Card */}
      {contract && (
        <div className="card bg-linear-to-r from-blue-50 to-white border-blue-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="badge badge-info">{CONTRACT_TYPE_LABELS[contract.contract_type]}</span>
                <h2 className="text-lg font-bold text-[var(--color-text)]">{contract.company_name}</h2>
              </div>
              <p className="text-xs text-[var(--color-muted)] mt-1">
                المنشأة: <b>{contract.facilities?.name}</b> ({contract.facilities?.code}) | المدة:{' '}
                <b>{contract.duration_months} شهر</b> (بدءاً من {contract.start_date})
              </p>
            </div>

            <div className="text-left rtl:text-right sm:border-r border-blue-200 sm:pr-6">
              <p className="text-xs text-[var(--color-muted)]">إجمالي قيمة العقد</p>
              <p className="text-xl font-bold text-[var(--color-primary)] currency">
                {formatCurrency(contract.total_contract_value)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-[var(--color-muted)] font-semibold">إجمالي المسدد حتى الآن</p>
          <p className="text-xl font-bold text-[var(--color-success)] currency mt-1">
            {formatCurrency(totalPaid)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--color-muted)] font-semibold">المتبقي من قيمة العقد</p>
          <p className="text-xl font-bold text-[var(--color-accent)] currency mt-1">
            {formatCurrency(remaining)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-[var(--color-muted)] font-semibold">نسبة السداد التراكمي</p>
          <p className="text-xl font-bold text-[var(--color-primary)] mt-1">
            {contract ? Math.round((totalPaid / contract.total_contract_value) * 100) : 0}%
          </p>
        </div>
      </div>

      {isClosed && (
        <div className="alert-warning">
          <span>🔒</span>
          <div>
            <p className="font-bold">هذا الشهر مقفل بعد الاعتماد النهائي</p>
            <p className="text-xs mt-0.5">لا يمكن تسجيل سداد لهذا الشهر.</p>
          </div>
        </div>
      )}

      {willExceedContract && (
        <div className="alert-warning" style={{ background: '#FFFBEB', borderColor: '#F59E0B' }}>
          <span>⚠️</span>
          <div>
            <p className="font-bold" style={{ color: '#B45309' }}>
              تحذير: هذا السداد سيتجاوز إجمالي قيمة العقد!
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>
              المجموع التراكمي بعد هذا السداد ({formatCurrency(nextCumulative)}) سيتجاوز قيمة العقد الكلية ({formatCurrency(contract.total_contract_value)}).
            </p>
          </div>
        </div>
      )}

      {msg && (
        <div className={msg.type === 'success' ? 'alert-success' : 'alert-error'}>
          {msg.type === 'success' ? '✓ ' : '⚠️ '} {msg.text}
        </div>
      )}

      {/* Payment Entry Form */}
      {canEditFinancials && !isClosed && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="section-title">تسجيل دفعة سداد شهرية جديدة</h3>
            <MonthSelector selectedMonth={selectedMonth} onChange={setSelectedMonth} />
          </div>

          <form onSubmit={handlePayment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="المبلغ المسدد (ج.م)"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />

              <FormField
                label="ملاحظات / رقم الشيك أو إذن الصرف"
                placeholder="بيان إضافي (اختياري)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-[var(--color-border)]">
              <button
                type="submit"
                disabled={saving || !amount}
                className="btn btn-primary min-w-[160px]"
              >
                {saving ? 'جاري التسجيل...' : 'تسجيل السداد 💳'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payments History Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="section-title">سجل السدادات السابقة لهذا العقد</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>الرقم المرجعي</th>
                <th>عن شهر</th>
                <th>المبلغ المسدد</th>
                <th>البيان / الملاحظات</th>
                <th>تاريخ التسجيل</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[var(--color-muted)]">
                    لم يتم تسجيل أي دفعات سداد لهذا العقد حتى الآن
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="badge badge-info text-xs font-mono">{p.ref_number || '—'}</span>
                    </td>
                    <td className="font-bold text-xs">{p.month.slice(0, 7)}</td>
                    <td className="currency font-bold text-[var(--color-success)]">
                      {formatCurrency(p.amount_paid)}
                    </td>
                    <td className="text-xs text-[var(--color-muted)]">{p.notes || '—'}</td>
                    <td className="text-xs">{new Date(p.created_at).toLocaleDateString('ar-EG')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
