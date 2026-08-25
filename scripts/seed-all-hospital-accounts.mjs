import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

const envConfig = {}
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=')
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim()
        const val = trimmed.slice(idx + 1).trim()
        envConfig[key] = val
      }
    }
  })
}

const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY || envConfig.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function run() {
  console.log('🚀 Starting bulk hospital accounts generation via Supabase Admin API...')

  // 1. Fetch all facilities
  const { data: facilities, error: facErr } = await supabase
    .from('facilities')
    .select('id, name, code, institutional_code')
    .order('code')

  if (facErr || !facilities) {
    console.error('Error fetching facilities:', facErr)
    process.exit(1)
  }

  console.log(`Found ${facilities.length} facilities in database.`)

  // 2. Fetch roles
  const { data: roles, error: rolesErr } = await supabase
    .from('roles')
    .select('id, name')

  if (rolesErr || !roles) {
    console.error('Error fetching roles:', rolesErr)
    process.exit(1)
  }

  const roleMap = {}
  roles.forEach((r) => {
    roleMap[r.name] = r.id
  })

  // 3. Fetch existing users to avoid re-creating or to update them
  const { data: existingUsersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existingUsers = existingUsersData?.users || []
  const existingEmailMap = new Map()
  existingUsers.forEach((u) => existingEmailMap.set(u.email.toLowerCase(), u))

  console.log(`Found ${existingUsers.length} existing users in Supabase Auth.`)

  const summary = []

  for (const fac of facilities) {
    const codeLower = fac.code.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Create 2 accounts per facility: Admin & Data Entry
    const accounts = [
      {
        email: `admin.${codeLower}@health.gov.eg`,
        password: `Hospital@123456`,
        fullName: `مدير ${fac.name}`,
        roleName: 'hospital_admin',
        facilityId: fac.id,
      },
      {
        email: `entry.${codeLower}@health.gov.eg`,
        password: `Entry@123456`,
        fullName: `مسؤول حسابات ${fac.name}`,
        roleName: 'hospital_data_entry',
        facilityId: fac.id,
      },
    ]

    for (const acc of accounts) {
      try {
        let userId = null
        const existing = existingEmailMap.get(acc.email.toLowerCase())

        if (existing) {
          userId = existing.id
          // Update password and metadata
          await supabase.auth.admin.updateUserById(userId, {
            password: acc.password,
            email_confirm: true,
            user_metadata: { full_name: acc.fullName },
          })
        } else {
          // Create new user
          const { data: created, error: createErr } = await supabase.auth.admin.createUser({
            email: acc.email,
            password: acc.password,
            email_confirm: true,
            user_metadata: { full_name: acc.fullName },
          })
          if (createErr) throw createErr
          userId = created.user.id
        }

        if (userId) {
          // Profile
          await supabase.from('profiles').upsert({
            id: userId,
            full_name: acc.fullName,
            must_change_password: false,
            is_active: true,
          })

          // Role assignment
          const roleId = roleMap[acc.roleName]
          if (roleId) {
            await supabase.from('user_facility_roles').delete().eq('user_id', userId)
            await supabase.from('user_facility_roles').insert({
              user_id: userId,
              role_id: roleId,
              facility_id: acc.facilityId,
            })
          }

          summary.push({
            facility: fac.name,
            code: fac.code,
            role: acc.roleName === 'hospital_admin' ? 'مدير مستشفى' : 'مدخل بيانات',
            email: acc.email,
            password: acc.password,
          })
        }
      } catch (err) {
        console.error(`Failed for ${acc.email}:`, err.message)
      }
    }
  }

  console.log(`\n🎉 Successfully generated/updated ${summary.length} accounts for all ${facilities.length} hospitals!`)
}

run()
