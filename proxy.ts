import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // تحديث الجلسة
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // المسارات العامة (لا تحتاج تسجيل دخول)
  const publicPaths = ['/login']
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p))

  // غير مسجل دخول → توجيه لصفحة الدخول
  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // مسجل دخول على صفحة عامة → توجيه للداشبورد
  if (user && isPublicPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // مسجل دخول → تحقق من must_change_password
  if (user && !isPublicPath && pathname !== '/change-password') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('id', user.id)
      .single()

    if (profile?.must_change_password) {
      return NextResponse.redirect(new URL('/change-password', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * تطبيق على كل المسارات ماعدا:
     * - _next/static
     * - _next/image
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
