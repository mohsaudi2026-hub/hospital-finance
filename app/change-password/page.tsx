'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const minLength = 8
  const hasUppercase = /[A-Z]/.test(newPassword)
  const hasNumber = /[0-9]/.test(newPassword)
  const isLongEnough = newPassword.length >= minLength
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== ''

  const isValid = isLongEnough && hasUppercase && hasNumber && passwordsMatch

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!isValid) {
      setError('يرجى استيفاء جميع متطلبات كلمة المرور')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError('حدث خطأ أثناء تحديث كلمة المرور. يرجى المحاولة مرة أخرى.')
      setLoading(false)
      return
    }

    // تحديث must_change_password في profile
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user.id)
    }

    router.push('/dashboard')
  }

  function PasswordRule({ met, label }: { met: boolean; label: string }) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span style={{ color: met ? 'var(--color-success)' : 'var(--color-muted)' }}>
          {met ? '✓' : '○'}
        </span>
        <span style={{ color: met ? 'var(--color-success)' : 'var(--color-muted)', fontWeight: met ? 600 : 400 }}>
          {label}
        </span>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="w-full max-w-md">
        {/* شعار */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-white text-2xl font-bold mb-4"
            style={{ background: 'var(--color-primary)' }}
          >
            🔐
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--color-text)' }}>
            تغيير كلمة المرور
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            يجب عليك تعيين كلمة مرور جديدة قبل المتابعة
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background: 'var(--color-warning)',
            opacity: 0.9,
            color: 'white',
            marginBottom: '1.5rem',
          }}
        >
          <div className="alert-warning" style={{ background: '#FEF3C7', color: '#92400E' }}>
            <span>⚠️</span>
            <span className="text-sm">
              هذا أول دخول لك أو تم إعادة تعيين كلمة مرورك. يجب تغييرها الآن.
            </span>
          </div>
        </div>

        <div className="card">
          {error && (
            <div className="alert-error mb-5">
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-5">

              {/* كلمة المرور الجديدة */}
              <div>
                <label htmlFor="new-password" className="form-label">
                  كلمة المرور الجديدة <span className="required">*</span>
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input text-left font-mono"
                    placeholder="أدخل كلمة مرور قوية"
                    autoComplete="new-password"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
                    style={{ color: 'var(--color-muted)' }}
                    aria-label={showNewPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showNewPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* متطلبات كلمة المرور */}
              {newPassword && (
                <div
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: '#F9FAFB', border: '1px solid var(--color-border)' }}
                >
                  <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-muted)' }}>
                    متطلبات كلمة المرور:
                  </p>
                  <PasswordRule met={isLongEnough} label="8 أحرف على الأقل" />
                  <PasswordRule met={hasUppercase} label="حرف كبير واحد على الأقل (A-Z)" />
                  <PasswordRule met={hasNumber} label="رقم واحد على الأقل (0-9)" />
                </div>
              )}

              {/* تأكيد كلمة المرور */}
              <div>
                <label htmlFor="confirm-password" className="form-label">
                  تأكيد كلمة المرور <span className="required">*</span>
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`form-input text-left font-mono ${confirmPassword && !passwordsMatch ? 'error' : ''}`}
                    placeholder="أعد إدخال كلمة المرور"
                    autoComplete="new-password"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none"
                    style={{ color: 'var(--color-muted)' }}
                    aria-label={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showConfirmPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="form-error">
                    <span>✗</span> كلمتا المرور غير متطابقتين
                  </p>
                )}
                {confirmPassword && passwordsMatch && (
                  <p className="text-sm mt-1" style={{ color: 'var(--color-success)' }}>
                    ✓ كلمتا المرور متطابقتان
                  </p>
                )}
              </div>

              {/* زر الحفظ */}
              <button
                id="change-password-submit"
                type="submit"
                disabled={loading || !isValid}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    جاري الحفظ...
                  </>
                ) : (
                  'حفظ كلمة المرور والمتابعة'
                )}
              </button>

            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
