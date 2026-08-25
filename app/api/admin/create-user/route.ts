import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, phone, roleId, facilityId, mustChangePassword } = await req.json()

    if (!email || !password || !fullName || !roleId) {
      return NextResponse.json(
        { error: 'يرجى إدخال كافة البيانات الأساسية (الاسم، البريد، كلمة المرور، والدور)' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    const userId = authData.user.id

    // 2. Create profile
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      phone: phone || null,
      must_change_password: mustChangePassword ?? true,
      is_active: true,
    })

    // 3. Link User Role & Facility
    await supabaseAdmin.from('user_facility_roles').insert({
      user_id: userId,
      role_id: roleId,
      facility_id: facilityId || null,
    })

    return NextResponse.json({
      success: true,
      message: 'تم إنشاء المستخدم وتعيين المنشأة والصلاحية بنجاح',
      user: { id: userId, email, fullName },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
