import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const facilityId = searchParams.get('facilityId')

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

    // 1. Fetch Auth Users (to get real emails and metadata)
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const authUsers = authData?.users || []
    const userMetaMap = new Map<string, { email: string; fullName: string | null }>()
    authUsers.forEach((u) => {
      userMetaMap.set(u.id, {
        email: u.email || '',
        fullName: (u.user_metadata?.full_name as string) || null,
      })
    })

    // 2. Fetch Profiles with User Facility Roles
    const { data: profilesData, error: pErr } = await supabaseAdmin.from('profiles').select(`
      id,
      full_name,
      national_id,
      phone,
      is_active,
      must_change_password,
      created_at,
      user_facility_roles (
        role_id,
        facility_id,
        roles ( name ),
        facilities ( name, code )
      )
    `).order('created_at', { ascending: false })

    if (pErr) throw pErr

    const profileMap = new Map<string, any>()
    ;(profilesData || []).forEach((p: any) => {
      profileMap.set(p.id, p)
    })

    // 3. Merge profiles and auth users so no user is omitted
    let users = (profilesData || []).map((p: any) => {
      const ufr = p.user_facility_roles?.[0]
      const authMeta = userMetaMap.get(p.id)
      const resolvedName = p.full_name || authMeta?.fullName || (p.email ? p.email.split('@')[0] : null)

      return {
        id: p.id,
        email: authMeta?.email || p.email || null,
        full_name: resolvedName,
        national_id: p.national_id || null,
        phone: p.phone || null,
        is_active: p.is_active ?? true,
        must_change_password: p.must_change_password ?? false,
        role_name: ufr?.roles?.name || null,
        role_id: ufr?.role_id || null,
        facility_name: ufr?.facilities?.name || null,
        facility_id: ufr?.facility_id || null,
        facility_code: ufr?.facilities?.code || null,
        created_at: p.created_at,
      }
    })

    // Also include any auth users that might not have a profile record yet
    authUsers.forEach((au) => {
      if (!profileMap.has(au.id)) {
        users.push({
          id: au.id,
          email: au.email || null,
          full_name: (au.user_metadata?.full_name as string) || (au.email ? au.email.split('@')[0] : 'مستخدم'),
          national_id: null,
          phone: null,
          is_active: true,
          must_change_password: false,
          role_name: au.email === 'super@admin.com' ? ('super_admin' as any) : null,
          role_id: null,
          facility_name: null,
          facility_id: null,
          facility_code: null,
          created_at: au.created_at,
        })
      }
    })

    // Filter by facility if specified
    if (facilityId && facilityId !== 'all') {
      users = users.filter((u) => u.facility_id === facilityId)
    }

    return NextResponse.json({ success: true, users })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching users' }, { status: 500 })
  }
}
