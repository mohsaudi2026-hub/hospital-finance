import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
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

  const usersToCreate = [
    {
      email: 'super@admin.com',
      password: 'Admin@123456',
      fullName: 'مدير عام المنظومة',
      roleName: 'super_admin',
      facilityCode: null,
    },
    {
      email: 'viewer@health.gov.eg',
      password: 'Viewer@123456',
      fullName: 'د. مسؤول المتابعة بالوزارة',
      roleName: 'ministry_viewer',
      facilityCode: null,
    },
    {
      email: 'admin@demo-hospital.com',
      password: 'Hospital@123456',
      fullName: 'د. مدير المستشفى التجريبي',
      roleName: 'hospital_admin',
      facilityCode: 'DEMO01',
    },
    {
      email: 'entry@demo-hospital.com',
      password: 'Entry@123456',
      fullName: 'أ. مسؤول الحسابات والإدخال',
      roleName: 'hospital_data_entry',
      facilityCode: 'DEMO01',
    },
  ]

  const results: any[] = []

  // Ensure DEMO01 facility exists
  const { data: dir } = await supabaseAdmin
    .from('health_directorates')
    .select('id')
    .limit(1)
    .single()

  if (dir) {
    await supabaseAdmin.from('facilities').upsert(
      {
        directorate_id: dir.id,
        name: 'مستشفى النموذج التجريبي للاختبار',
        code: 'DEMO01',
        institutional_code: '999001',
        facility_type: 'hospital',
      },
      { onConflict: 'code' }
    )
  }

  for (const u of usersToCreate) {
    try {
      // 1. Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existing = existingUsers?.users?.find((x) => x.email === u.email)

      let userId = existing?.id

      if (!existing) {
        // Create user via official Supabase Admin API
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        })
        if (createErr) throw createErr
        userId = created.user.id
      } else {
        // Update password
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password: u.password,
          email_confirm: true,
          user_metadata: { full_name: u.fullName },
        })
      }

      if (userId) {
        // 2. Profile
        await supabaseAdmin.from('profiles').upsert({
          id: userId,
          full_name: u.fullName,
          must_change_password: false,
          is_active: true,
        })

        // 3. Role
        const { data: roleData } = await supabaseAdmin
          .from('roles')
          .select('id')
          .eq('name', u.roleName)
          .single()

        let facId = null
        if (u.facilityCode) {
          const { data: fData } = await supabaseAdmin
            .from('facilities')
            .select('id')
            .eq('code', u.facilityCode)
            .single()
          facId = fData?.id || null
        }

        if (roleData) {
          await supabaseAdmin.from('user_facility_roles').delete().eq('user_id', userId)
          await supabaseAdmin.from('user_facility_roles').insert({
            user_id: userId,
            role_id: roleData.id,
            facility_id: facId,
          })
        }

        results.push({ email: u.email, status: 'Success', userId })
      }
    } catch (err: any) {
      results.push({ email: u.email, status: 'Error', error: err.message })
    }
  }

  return NextResponse.json({
    message: 'Seed completed successfully via official Supabase Admin API',
    results,
  })
}
