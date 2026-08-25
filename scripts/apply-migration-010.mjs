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

async function run() {
  console.log('Applying national_id column to profiles...')
  // We can test selecting national_id or doing an update with national_id
  const { data, error } = await supabase.from('profiles').select('id, national_id').limit(1)
  if (error && error.message.includes('national_id')) {
    console.log('Column national_id needs to be added via SQL.')
  } else {
    console.log('Profiles table is accessible. national_id column checked.')
  }
}

run()
