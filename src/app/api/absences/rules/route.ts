import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { evaluateForBoutique } from '@/lib/absences/leaveRulesServer'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET ?from=…&to=… : règles qui s'appliquent à une demande de congés payés d'une boutique
// (blocks = impossible, warnings = déconseillé). Vide pour les autres utilisateurs.
export async function GET(request: NextRequest) {
  const userId = getUserId()
  const empty = { blocks: [] as string[], warnings: [] as string[] }
  if (!userId) return NextResponse.json(empty)
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from'); const to = searchParams.get('to')
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return NextResponse.json(empty)

  const supabase = createAdminClient()
  const ctx = await getActingContext(supabase, userId)
  if (!ctx.isBoutique || !ctx.boutiqueId) return NextResponse.json(empty)
  const asPeriod = (v: string | null) => (v === 'am' || v === 'pm' ? v : 'full')
  const evaluation = await evaluateForBoutique(supabase, ctx.boutiqueId, from, to, {
    memberId: ctx.actingUserId, startPeriod: asPeriod(searchParams.get('sp')), endPeriod: asPeriod(searchParams.get('ep')),
    excludeAbsenceId: searchParams.get('exclude'),
  })
  return NextResponse.json(evaluation, { headers: { 'Cache-Control': 'no-store' } })
}
