'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SUPPORT_PHONE } from '@/lib/constants'

interface Announcement {
  id: string
  title: string
  body: string
}

const backgroundImages = [
  {
    src: '/images/bg-3.jpg',
    title: 'نهر النيل الخالد — جمهورية مصر العربية',
  },
  {
    src: '/images/bg-2.jpg',
    title: 'صروح الرعاية الصحية والطبية الحديثة',
  },
  {
    src: '/images/bg-5.jpg',
    title: 'منظومة المستشفيات والمراكز العلاجية التخصصية',
  },
  {
    src: '/images/bg-4.jpg',
    title: 'بيئة استشفاء نقية ومتطورة',
  },
  {
    src: '/images/bg-1.jpg',
    title: 'طبيعة هادئة وجمالية متجددة',
  },
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [showPassword, setShowPassword] = useState(false)
  const [currentBgIndex, setCurrentBgIndex] = useState(0)

  // التبديل التلقائي للخلفيات كل 7 ثوانٍ بنعومة (مثل متصفح Brave)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBgIndex((prev) => (prev + 1) % backgroundImages.length)
    }, 7000)
    return () => clearInterval(timer)
  }, [])

  // جلب الإعلانات النشطة
  useEffect(() => {
    async function loadAnnouncements() {
      const { data } = await supabase
        .from('announcements')
        .select('id, title, body')
        .eq('is_active', true)
        .order('display_order')
        .limit(3)
      if (data) setAnnouncements(data)
    }
    loadAnnouncements()
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      } else if (authError.message.includes('Email not confirmed')) {
        setError('البريد الإلكتروني لم يتم تأكيده بعد في Supabase')
      } else {
        setError(authError.message || 'حدث خطأ أثناء تسجيل الدخول')
      }
      setLoading(false)
      return
    }

    router.refresh()
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)' }}>

      {/* ══════════════════════════════════════════════════
          العمود الأيمن — خلفيات جمالية متغيرة + هوية الوزارة
      ══════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-7/12 xl:w-2/3 flex-col relative overflow-hidden">
        {/* صور الخلفيات مع تأثير التلاشي التدريجي (Cross-fade) */}
        {backgroundImages.map((bg, idx) => (
          <div
            key={bg.src}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-cover bg-center ${
              idx === currentBgIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            style={{
              backgroundImage: `url('${bg.src}')`,
              transition: 'opacity 1.2s ease-in-out, transform 8s ease-out',
            }}
          />
        ))}

        {/* طبقة تدرج زجاجية كحلية أنيقة لحماية قراءة النصوص (Glassmorphism Overlay) */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, rgba(13, 42, 86, 0.88) 0%, rgba(30, 90, 168, 0.75) 50%, rgba(13, 42, 86, 0.90) 100%)',
            backdropFilter: 'blur(2px)',
          }}
        />

        {/* المحتوى الداخلي فوق الصورة */}
        <div className="relative z-10 flex flex-col justify-between h-full p-8 xl:p-12 text-white">

          {/* الترويسة العليا: الشعار الرسمي وهوية الوزارة والمكتب الفني */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-lg inline-flex">
              {/* شعار وزارة الصحة والسكان الرسمي */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-white rounded-2xl p-1 shadow-md">
                <Image
                  src="/images/mohp-logo.png"
                  alt="شعار وزارة الصحة والسكان"
                  fill
                  sizes="80px"
                  className="object-contain p-0.5"
                  priority
                />
              </div>

              <div>
                <p className="text-white font-extrabold text-base sm:text-lg leading-snug">
                  جمهورية مصر العربية — وزارة الصحة والسكان
                </p>
                <p className="text-xs sm:text-sm font-semibold text-amber-200 mt-0.5">
                  المكتب الفني لمساعد الوزير للشئون المالية والإدارية
                </p>
              </div>
            </div>

            <div className="pt-2">
              <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
                منظومة البيانات المالية
                <br />
                <span className="text-amber-300">للمستشفيات والمنشآت الصحية</span>
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-2 max-w-xl leading-relaxed">
                منصة إلكترونية متكاملة لمتابعة وتحصيل الإيرادات الذاتية لصندوق تحسين الخدمة، وضبط الاستقطاعات، ومصروفات هيئة الشراء الموحد والعقود الخدمية.
              </p>
            </div>
          </div>

          {/* المنتصف: لوحة الإعلانات والتوجيهات الوزارية */}
          <div className="my-auto py-4">
            {announcements.length > 0 ? (
              <div className="space-y-3 max-w-xl">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                  <span>📢</span>
                  <span>تنبيهات وتوجيهات وزارية هامة</span>
                </div>
                {announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="rounded-2xl p-4 bg-white/10 backdrop-blur-md border border-white/20 shadow-md transition-all hover:bg-white/15"
                  >
                    <p className="text-white font-bold text-sm mb-1">{ann.title}</p>
                    <p className="text-xs text-white/85 leading-relaxed">{ann.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-md p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚖️</span>
                  <div>
                    <p className="text-xs font-bold text-white">الالتزام بلائحة الموارد الذاتية</p>
                    <p className="text-[11px] text-white/75 mt-0.5">
                      تطبيق قواعد توزيع الحصيلة طبقاً للمادتين (14) و(15) مع الالتزام بالمواعيد الشهرية للإقفال المالي.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* التذييل السفلي: مؤشر تبديل الخلفيات ومصدر الصورة */}
          <div className="flex items-center justify-between pt-4 border-t border-white/15 text-xs text-white/70">
            <p className="flex items-center gap-2 text-[11px]">
              <span>📍 {backgroundImages[currentBgIndex].title}</span>
            </p>

            {/* نقاط التبديل اليدوي بين الخلفيات (Dots) */}
            <div className="flex items-center gap-1.5">
              {backgroundImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBgIndex(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentBgIndex ? 'w-6 bg-amber-300' : 'w-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`خلفية رقم ${idx + 1}`}
                />
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          العمود الأيسر — نموذج تسجيل الدخول
      ══════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-12">
        {/* شعار للموبايل */}
        <div className="lg:hidden mb-6 text-center">
          <div className="inline-block relative w-20 h-20 bg-white rounded-2xl p-1 shadow-md mb-2">
            <Image
              src="/images/mohp-logo.png"
              alt="شعار وزارة الصحة والسكان"
              fill
              sizes="80px"
              className="object-contain p-1"
            />
          </div>
          <p className="font-bold text-base text-[var(--color-text)]">
            وزارة الصحة والسكان
          </p>
          <p className="text-xs text-amber-800 font-semibold">
            المكتب الفني لمساعد الوزير للشئون المالية والإدارية
          </p>
        </div>

        <div className="w-full max-w-sm">
          {/* عنوان النموذج */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--color-text)]">
              تسجيل الدخول
            </h2>
            <p className="text-xs text-[var(--color-muted)] mt-1">
              أدخل بيانات حسابك المعتمد للدخول إلى المنظومة
            </p>
          </div>

          {/* رسالة خطأ */}
          {error && (
            <div className="alert-error mb-5">
              <span>⚠️</span> {error}
            </div>
          )}

          {/* النموذج */}
          <form onSubmit={handleLogin} noValidate>
            <div className="space-y-4">

              {/* البريد الإلكتروني */}
              <div>
                <label htmlFor="email" className="form-label text-xs">
                  البريد الإلكتروني
                  <span className="required">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input text-xs"
                  placeholder="super@admin.com"
                  dir="ltr"
                  style={{ textAlign: 'right' }}
                />
              </div>

              {/* كلمة المرور */}
              <div>
                <label htmlFor="password" className="form-label text-xs">
                  كلمة المرور
                  <span className="required">*</span>
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input text-xs"
                    placeholder="••••••••"
                    dir="ltr"
                    style={{ textAlign: 'right' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--color-muted)' }}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* رابط نسيت كلمة المرور */}
              <div className="text-start">
                <button
                  type="button"
                  onClick={() => setShowSupportModal(true)}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              {/* زر الدخول */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading || !email || !password}
                className="btn btn-primary w-full shadow-md mt-2"
              >
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    جاري التحقق والدخول...
                  </>
                ) : (
                  'تسجيل الدخول 🚀'
                )}
              </button>

            </div>
          </form>

          {/* Footer note */}
          <div className="mt-8 pt-6 border-t border-[var(--color-border)] text-center">
            <p className="text-[11px] text-[var(--color-muted)]">
              جميع الحقوق محفوظة © {new Date().getFullYear()} وزارة الصحة والسكان
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          Modal الدعم الفني
      ══════════════════════════════════════════════════ */}
      {showSupportModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="card max-w-sm w-full"
            style={{ boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div
                className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-white text-2xl mb-3 shadow-md"
                style={{ background: 'var(--color-primary)' }}
              >
                📞
              </div>
              <h3 className="text-base font-bold mb-1 text-[var(--color-text)]">
                إعادة تعيين كلمة المرور
              </h3>
              <p className="text-xs text-[var(--color-muted)] mb-4 leading-relaxed">
                لأسباب أمنية ولوائح الحوكمة المالية، يرجى التواصل مع الدعم الفني للمكتب الفني لإعادة تعيين الحساب.
              </p>
              <div
                className="rounded-xl p-3.5 mb-4 border border-blue-200"
                style={{ background: 'var(--color-primary-light)' }}
              >
                <p className="text-[11px] text-[var(--color-muted)] mb-1">الخط المباشر للدعم الفني</p>
                <a
                  href={`tel:${SUPPORT_PHONE}`}
                  className="text-xl font-extrabold text-[var(--color-primary)] block font-mono"
                  dir="ltr"
                >
                  {SUPPORT_PHONE}
                </a>
              </div>
              <button
                onClick={() => setShowSupportModal(false)}
                className="btn btn-outline w-full !min-h-[36px] text-xs font-semibold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
