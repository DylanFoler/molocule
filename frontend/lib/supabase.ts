import { createClient } from '@supabase/supabase-js'

// Fallback values prevent build-time crash when env vars aren't loaded yet.
// Real values are required at runtime — the app will not function without them.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
