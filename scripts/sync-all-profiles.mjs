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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAndSync() {
  console.log('Checking Auth users vs profiles...')

  const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = usersData?.users || []
  console.log(`Total Auth Users: ${authUsers.length}`)

  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name')
  console.log(`Total Profiles in DB: ${profiles?.length || 0}`, pErr || '')

  const { data: ufrList, error: ufrErr } = await supabase.from('user_facility_roles').select('id, user_id')
  console.log(`Total User Facility Roles in DB: ${ufrList?.length || 0}`, ufrErr || '')

  const { data: facs } = await supabase.from('facilities').select('id, code, name')
  const { data: roles } = await supabase.from('roles').select('id, name')
  const roleMap = {}
  roles?.forEach(r => roleMap[r.name] = r.id)

  const facMap = {}
  facs?.forEach(f => {
    const cleanCode = f.code.toLowerCase().replace(/[^a-z0-9]/g, '')
    facMap[cleanCode] = f
  })

  // Sync any missing profile or user_facility_role
  for (const user of authUsers) {
    const email = user.email.toLowerCase()
    const isSuper = email === 'super@admin.com'
    const isAdmin = email.startsWith('admin.')
    const isEntry = email.startsWith('entry.')

    let roleName = isSuper ? 'super_admin' : (isAdmin ? 'hospital_admin' : (isEntry ? 'hospital_data_entry' : null))
    let facId = null

    if (isAdmin || isEntry) {
      const codePart = email.split('@')[0].split('.')[1]
      const fac = facMap[codePart]
      if (fac) {
        facId = fac.id
      }
    }

    const fullName = user.user_metadata?.full_name || (isSuper ? 'مدير عام المنظومة' : 'موظف')

    // Upsert Profile
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      is_active: true,
      must_change_password: false,
    })

    // Upsert Role
    if (roleName && roleMap[roleName]) {
      await supabase.from('user_facility_roles').delete().eq('user_id', user.id)
      await supabase.from('user_facility_roles').insert({
        user_id: user.id,
        role_id: roleMap[roleName],
        facility_id: facId,
      })
    }
  }

  const { data: updatedProfiles } = await supabase.from('profiles').select('id')
  console.log(`✅ After sync, Total Profiles: ${updatedProfiles?.length}`)
}

checkAndSync()
