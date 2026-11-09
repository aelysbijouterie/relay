import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { automaticBlockedPeriods } from '@/lib/absences/leaveRules'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : périodes où une demande de congés payés est impossible pour la boutique connectée
// (périodes calculées + périodes « bloquantes » saisies par la RH, générales ou propres au magasin).
// Sert à colorer d'avance ces jours en rouge dans le calendrier. Vide pour les autres utilisateurs.
export async function GET() {
  const userId = getUserId()
  if (!userId) return NextResponse.json([])
  const supabase = createAdminClient()
  const ctx = await getActingContext(supabase, userId)
  if (!ctx.isBoutique || !ctx.boutiqueId) return NextResponse.json([])

  const year = new Date().getFullYear()
  const out: { label: string; start: string; end: string }[] = []
  for (let y = year - 1; y <= year + 2; y++) {
    for (const p of automaticBlockedPeriods(y)) out.push(p)
  }
  const { data: custom } = await supabase
    .from('leave_blocked_periods').select('label, start_date, end_date, kind')
    .or(`boutique_id.is.null,boutique_id.eq.${ctx.boutiqueId}`)
    .eq('kind', 'block')
  for (const p of custom ?? []) out.push({ label: p.label as string, start: p.start_date as string, end: p.end_date as string })
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
