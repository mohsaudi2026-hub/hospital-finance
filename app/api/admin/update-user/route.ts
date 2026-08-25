import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { userId, fullName, nationalId, phone, roleId, facilityId, newPassword, isActive } = await req.json()

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

    // 1. Update Profile
    const profileUpdates: any = {}
    if (fullName !== undefined) profileUpdates.full_name = fullName
    if (nationalId !== undefined) profileUpdates.national_id = nationalId
    if (phone !== undefined) profileUpdates.phone = phone
    if (isActive !== undefined) profileUpdates.is_active = isActive

    if (Object.keys(profileUpdates).length > 0) {
      await supabaseAdmin.from('profiles').update(profileUpdates).eq('id', userId)
    }

    // 2. Update Auth password or metadata if provided
    const authUpdates: any = {}
    if (newPassword && newPassword.trim().length >= 6) {
      authUpdates.password = newPassword.trim()
    }
    if (fullName) {
      authUpdates.user_metadata = { full_name: fullName }
    }

    if (Object.keys(authUpdates).length > 0) {
      await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates)
    }

    // 3. Update Role and Facility
    if (roleId !== undefined) {
      await supabaseAdmin.from('user_facility_roles').delete().eq('user_id', userId)

      if (roleId) {
        await supabaseAdmin.from('user_facility_roles').insert({
          user_id: userId,
          role_id: roleId,
          facility_id: facilityId || null,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث بيانات المستخدم وصلاحياته بنجاح',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء التحديث' }, { status: 500 })
  }
}
