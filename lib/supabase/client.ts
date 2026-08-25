import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ycmqjijomktoixaqsgeh.supabase.co'
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_S-iVMEFSEaeokD8IggdO7g_BJgiC69_'

  return createBrowserClient<Database>(supabaseUrl, supabaseKey)
}
