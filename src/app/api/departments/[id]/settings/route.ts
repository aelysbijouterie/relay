import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Réglages d'un département (ex : délai d'archivage auto).
// Réservé aux managers et admins.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', userId).single()

  if (profile?.role !== 'manager' && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux managers' }, { status: 403 })
  }

  const body = await request.json()
  const days = Number(body.auto_archive_days)
  if (!Number.isInteger(days) || days < 0 || days > 365) {
    return NextResponse.json({ error: 'Délai invalide (0 à 365 jours)' }, { status: 400 })
  }

  const { error } = await supabase
    .from('departments')
    .update({ auto_archive_days: days })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, auto_archive_days: days })
}