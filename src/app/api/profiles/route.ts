import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()

  // Une boutique ne voit que son propre compte : jamais le reste de l'entreprise.
  let sessionUserId: string | null = null
  try { sessionUserId = JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { /* noop */ }
  const ctx = sessionUserId ? await getActingContext(supabase, sessionUserId) : null

  let query = supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role, department_id, department:departments(id, name, color, slug)')
    .eq('is_active', true)
    .order('name')
  if (ctx?.isBoutique) query = query.eq('id', ctx.sessionUserId)

  const { data, error } = await query

  if (error) {
    console.error('Profiles error:', error.message)
    return NextResponse.json([])
  }
  return NextResponse.json(data ?? [])
}
