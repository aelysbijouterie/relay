import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

// GET : nombre de demandes de congés des boutiques en attente (pastille rouge de la RH validatrice).
export async function GET() {
  const userId = getUserId()
  const empty = NextResponse.json({ count: 0 }, { headers: { 'Cache-Control': 'no-store' } })
  if (!userId) return empty
  const supabase = createAdminClient()
  const { data: me } = await supabase.from('profiles').select('can_validate_boutiques').eq('id', userId).single()
  if (me?.can_validate_boutiques !== true) return empty

  const { data } = await supabase
    .from('absences')
    .select('id, user:profiles!user_id(boutique_id)')
    .in('status', ['En attente', 'Modif. en attente'])
  const count = (data ?? []).filter((a: Record<string, unknown>) => {
    const u = (Array.isArray(a.user) ? a.user[0] : a.user) as { boutique_id?: string | null } | undefined
    return !!u?.boutique_id
  }).length
  return NextResponse.json({ count }, { headers: { 'Cache-Control': 'no-store' } })
}
