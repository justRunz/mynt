import { createClient } from '@supabase/supabase-js'
import type { Database } from '@mynt/core'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required. See .env.example.',
  )
}

export const supabase = createClient<Database>(url, anonKey)
