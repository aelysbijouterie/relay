import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function createServerClient() {
  return createAdmin()
}

export function createAdminClient() {
  return createAdmin()
}

export function getCurrentUserId(): string {
  const cookieStore = cookies()
  const raw = cookieStore.get('relays-session')?.value
  if (!raw) throw new Error('Non authentifié')
  try {
    const s = JSON.parse(raw)
    if (!s.user_id) throw new Error('Non authentifié')
    return s.user_id as string
  } catch {
    throw new Error('Non authentifié')
  }
}
