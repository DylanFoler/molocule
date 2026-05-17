import { createClient } from '@supabase/supabase-js'

const PLACEHOLDER = 'https://placeholder.supabase.co'

function safeUrl(val: string | undefined): string {
  if (val && val.startsWith('https://')) return val
  return PLACEHOLDER
}

function safeKey(val: string | undefined): string {
  return val || 'placeholder-key'
}

export const supabase = createClient(
  safeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  safeKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
)

export function createServiceClient() {
  return createClient(
    safeUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    safeKey(process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
