import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET ?from=...&to=... : liste les collègues du MÊME service déjà absents
// (validés ou en attente) sur une période qui chevauche [from, to].
export async function GET(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ conflicts: [] })
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from'); const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({ conflicts: [] })

  const supabase = createAdminClient()
  const { data: me } = await supabase.from('profiles').select('department_id').eq('id', userId).single()
  if (!me?.department_id) return NextResponse.json({ conflicts: [] })

  // Absences non refusées qui chevauchent la période, hors soi-même,
  // pour les gens du même service.
  const { data } = await supabase
    .from('absences')
    .select('id, type, start_date, end_date, status, user:profiles!user_id(name, department_id)')
    .neq('user_id', userId).neq('status', 'Refusé')
    .lte('start_date', to).gte('end_date', from)

  type Row = { id: string; type: string; start_date: string; end_date: string; status: string; user?: { name?: string; department_id?: string } }
  const rows: Row[] = (data ?? []).map((a: Record<string, unknown>) => ({
    id: a.id as string, type: a.type as string,
    start_date: a.start_date as string, end_date: a.end_date as string, status: a.status as string,
    user: Array.isArray(a.user) ? a.user[0] : a.user,
  }))
  const conflicts = rows
    .filter(a => a.user?.department_id === me.department_id)
    .map(a => ({ name: a.user?.name ?? '?', type: a.type, start_date: a.start_date, end_date: a.end_date, status: a.status }))

  return NextResponse.json({ conflicts })
}
