import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'معرّف المستخدم مطلوب' }, { status: 400 })
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

    // 1. Delete roles and profile
    await supabaseAdmin.from('user_facility_roles').delete().eq('user_id', userId)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)

    // 2. Delete user from auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authError) {
      console.warn('Could not delete from auth.users:', authError.message)
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف المستخدم نهائياً بنجاح',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}
