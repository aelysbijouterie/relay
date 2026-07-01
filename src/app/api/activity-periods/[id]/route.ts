import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// DELETE : supprimer une période (manager/admin du service concerné).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()

  const { data: period } = await supabase.from('activity_periods').select('department_id').eq('id', params.id).single()
  if (!period) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  const { data: me } = await supabase.from('profiles').select('role, department_id').eq('id', userId).single()
  const ok = me && (me.role === 'manager' || me.role === 'admin') && me.department_id === period.department_id
  if (!ok) return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 })

  const { error } = await supabase.from('activity_periods').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
