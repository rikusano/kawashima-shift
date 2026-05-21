import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // 開発中の即時フィードバック用
  // eslint-disable-next-line no-console
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です')
}

export const supabase = createClient<Database>(url ?? '', anon ?? '', {
  auth: { persistSession: false },
})
