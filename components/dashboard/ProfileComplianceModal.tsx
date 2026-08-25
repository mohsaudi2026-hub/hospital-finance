'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ProfileComplianceModal() {
  const supabase = createClient()
  const [showModal, setShowModal] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function checkCompliance() {
      // Check if user already skipped during this browser session
      if (sessionStorage.getItem('compliance_skipped') === 'true') {
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)

      try {
        const { data: profile, error: pErr } = await supabase
          .from('profiles')
          .select('full_name, national_id, phone')
          .eq('id', user.id)
          .maybeSingle()

        if (!pErr && profile) {
          setFullName(profile.full_name || '')
          setNationalId(profile.national_id || '')
          setPhone(profile.phone || '')

          // If national_id is missing or incomplete, prompt modal
          if (!profile.national_id || profile.national_id.length !== 14) {
            setShowModal(true)
          }
        }
      } catch {
        // Column not yet added to live DB
      }
    }

    checkCompliance()
  }, [])

  function handleSkip() {
    sessionStorage.setItem('compliance_skipped', 'true')
    setShowModal(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const cleanNationalId = nationalId.trim()
    if (cleanNationalId.length !== 14 || !/^\d{14}$/.test(cleanNationalId)) {
      setError('الرقم القومي يجب أن يتكون من 14 رقماً صحيحاً')
      return
    }

    if (!fullName.trim()) {
      setError('يرجى كتابة الاسم الرباعي المعتمد')
      return
    }

    setSaving(true)

    try {
      if (userId) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({
            full_name: fullName.trim(),
            national_id: cleanNationalId,
            phone: phone.trim() || null,
          })
          .eq('id', userId)

        if (updateErr) throw updateErr

        sessionStorage.setItem('compliance_skipped', 'true')
        setShowModal(false)
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ البيانات')
    } finally {
      setSaving(false)
    }
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        className="card max-w-lg w-full bg-white shadow-2xl border border-blue-200 animate-in fade-in zoom-in-95 duration-200"
        style={{ borderRadius: '1.25rem' }}
      >
        {/* Header */}
        <div className="flex items-start gap-3.5 pb-4 border-b border-gray-100">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-2xl shrink-0 shadow-md"
            style={{ background: 'linear-gradient(135deg, #1E5AA8 0%, #154080 100%)' }}
          >
            🛡️
          </div>
          <div>
            <h3 className="text-base font-extrabold text-[var(--color-text)]">
              استيفاء بيانات الامتثال والحوكمة الأمنية
            </h3>
            <p className="text-xs text-[var(--color-muted)] mt-0.5 leading-relaxed">
              لضمان سلامة العمليات المالية والمسؤولية الإدارية، يرجى تأكيد بيانات الهوية الوطنية.
            </p>
          </div>
        </div>

        {/* Temporary warning badge */}
        <div className="my-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>
            يمكنك <b>تخطي هذه الخطوة مؤقتاً</b> للمتابعة الآن، وسيتم الإلزام الكامل قريباً.
          </span>
        </div>

        {error && (
          <div className="alert-error text-xs mb-4">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="form-label">
              الاسم الرباعي المعتمد <span className="required">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="اكتب اسمك الرباعي كما في بطاقة الرقم القومي"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input text-xs"
            />
          </div>

          <div>
            <label className="form-label">
              الرقم القومي (14 رقماً) <span className="required">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={14}
              placeholder="2900101XXXXXXXX"
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
              className="form-input text-xs font-mono"
              dir="ltr"
              style={{ textAlign: 'right' }}
            />
            <p className="text-[11px] text-[var(--color-muted)] mt-1">
              عدد الأرقام المدخلة: <b>{nationalId.length}</b> من 14
            </p>
          </div>

          <div>
            <label className="form-label">رقم الهاتف المحمول للتواصل</label>
            <input
              type="tel"
              placeholder="010XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="form-input text-xs"
              dir="ltr"
              style={{ textAlign: 'right' }}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-3">
            <button
              type="button"
              onClick={handleSkip}
              className="btn btn-outline text-xs !py-2 text-gray-600 hover:bg-gray-100"
            >
              تخطي مؤقتاً للمتابعة ⏱️
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary text-xs !py-2 shadow-md"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ وتأكيد البيانات ✅'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
