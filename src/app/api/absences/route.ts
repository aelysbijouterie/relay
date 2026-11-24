import { NextRequest, NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { sendRhRequestMail } from '@/lib/absences/rhMail'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getActingContext } from '@/lib/boutique/session'
import { evaluateForBoutique } from '@/lib/absences/leaveRulesServer'
import { expandWeeklyPeriods, MAX_RECURRING_PERIODS } from '@/lib/absences/recurrence'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  return readSessionUserId()
}

// GET : toutes les absences (tout le monde voit tout), avec infos utilisateur.
// Filtre optionnel ?from=YYYY-MM-DD&to=YYYY-MM-DD pour une plage.
export async function GET(request: NextRequest) {
  const authUserId = readSessionUserId()
  if (!authUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  // Une boutique ne voit que les absences de SA boutique.
  const sessionUserId = getUserId()
  const ctx = sessionUserId ? await getActingContext(supabase, sessionUserId) : null

  let query = supabase
    .from('absences')
    .select(`
      id, user_id, type, start_date, end_date, start_period, end_period,
      reason, status, reviewed_by, reviewed_at, review_note, created_at,
      user:profiles!user_id(id, name, avatar_url, department_id, boutique_id, boutique:boutiques!boutique_id(name, code), department:departments!department_id(name, color))
    `)
    .order('start_date', { ascending: true })

  if (from) query = query.gte('end_date', from)
  if (to)   query = query.lte('start_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })

  let mapped = (data ?? []).map((a: Record<string, unknown>) => {
    const user = (Array.isArray(a.user) ? a.user[0] : a.user) as Record<string, unknown> | undefined
    const boutique = user ? (Array.isArray(user.boutique) ? user.boutique[0] : user.boutique) : undefined
    return { ...a, user: user ? { ...user, boutique } : user }
  })
  if (ctx?.isBoutique) {
    mapped = mapped.filter(a => (a.user as { boutique_id?: string } | undefined)?.boutique_id === ctx.boutiqueId)
  }
  return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } })
}

// POST : créer une demande d'absence (statut "En attente").
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const { type, start_date, end_date, start_period, end_period, reason, has_file } = body

  if (!type || !start_date || !end_date) {
    return NextResponse.json({ error: 'Type et dates requis' }, { status: 400 })
  }
  if (new Date(end_date) < new Date(start_date)) {
    return NextResponse.json({ error: 'La date de fin doit être après la date de début' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Boutique : la demande est posée au nom du collaborateur choisi. Les congés
  // payés remontent TOUS à la RH ; seules les périodes d'alternance sont libres.
  const ctx = await getActingContext(supabase, userId)
  if (ctx.isBoutique && !ctx.actingUserId) {
    return NextResponse.json({ error: 'Choisissez d’abord le collaborateur concerné' }, { status: 400 })
  }
  const requesterId = ctx.actingUserId ?? userId

  // Boutique, congés payés : certaines périodes sont refusées d'office (soldes, Saint-Valentin,
  // fête des mères, Black Friday → soldes de janvier, changement de merch, apprenti·e à l'école…).
  if (ctx.isBoutique && ctx.boutiqueId && (type === 'Congés payés' || type === 'RTT')) {
    const evaluation = await evaluateForBoutique(supabase, ctx.boutiqueId, start_date, end_date, {
      memberId: requesterId, startPeriod: start_period ?? 'full', endPeriod: end_period ?? 'full', applyCap: type === 'Congés payés',
    })
    if (evaluation.blocks.length > 0) {
      return NextResponse.json({ error: `Demande impossible sur ces dates : ${evaluation.blocks.join(' ; ')}`, blocks: evaluation.blocks }, { status: 422 })
    }
  }
  // Boutique : « Congés payés » (à valider par la RH), « Alternance » (saisie libre) et les absences signalées
  // (« Maladie », « Autre » : la RH est informée, aucune validation).
  if (ctx.isBoutique && type !== 'Congés payés' && type !== 'Alternance' && type !== 'Maladie' && type !== 'Autre') {
    // Les RTT ne sont ouverts qu'aux cadres (profil is_cadre).
    let okRtt = false
    if (type === 'RTT') {
      const { data: who } = await supabase.from('profiles').select('is_cadre').eq('id', requesterId).single()
      okRtt = who?.is_cadre === true
    }
    if (!okRtt) return NextResponse.json({ error: 'Type d\'absence non disponible pour ce collaborateur' }, { status: 400 })
  }

  // Auto-validation : les managers/admins et le motif "Alternance" ne
  // nécessitent pas de validation (statut "Validé" directement).
  const { data: me } = await supabase.from('profiles').select('role').eq('id', requesterId).single()
  const autoValidated = ctx.isBoutique
    ? (type === 'Alternance' || type === 'Maladie' || type === 'Autre')
    : (me?.role === 'manager' || me?.role === 'admin' || type === 'Alternance')

  // Alternance récurrente (« tous les lundis et mardis jusqu'au … ») : une période par semaine, créées d'un coup.
  const weekdays: number[] | null = Array.isArray(body.recurrence?.weekdays)
    ? [...new Set<number>((body.recurrence.weekdays as unknown[]).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))] : null
  if (weekdays && type === 'Alternance') {
    const periods = expandWeeklyPeriods(start_date, end_date, weekdays)
    if (periods.length === 0) return NextResponse.json({ error: 'Aucun des jours choisis ne tombe dans cette période' }, { status: 400 })
    if (periods.length > MAX_RECURRING_PERIODS) return NextResponse.json({ error: `Trop de périodes (${periods.length}) : limitez la date de fin (maximum ${MAX_RECURRING_PERIODS} périodes)` }, { status: 400 })
    // Jamais de doublon : les périodes d'alternance déjà enregistrées pour cette personne sont ignorées.
    const { data: existing } = await supabase.from('absences').select('start_date, end_date').eq('user_id', requesterId).eq('type', 'Alternance')
      .gte('end_date', start_date).lte('start_date', end_date)
    const have = new Set((existing ?? []).map((e: { start_date: string; end_date: string }) => `${e.start_date}|${e.end_date}`))
    const fresh = periods.filter(p => !have.has(`${p.start}|${p.end}`))
    if (fresh.length === 0) return NextResponse.json({ error: 'Toutes ces périodes sont déjà enregistrées' }, { status: 409 })
    const note = `Planning récurrent (${fresh.length} période${fresh.length > 1 ? 's' : ''}, jusqu'au ${end_date.slice(8, 10)}/${end_date.slice(5, 7)}/${end_date.slice(0, 4)})`
    const now = new Date().toISOString()
    const { data: rows, error: recErr } = await supabase.from('absences').insert(fresh.map(p => ({
      user_id: requesterId, type, start_date: p.start, end_date: p.end, start_period: 'full', end_period: 'full',
      reason: [reason?.trim(), note].filter(Boolean).join(' — '), status: 'Validé', reviewed_by: requesterId, reviewed_at: now,
    }))).select('id')
    if (recErr || !rows?.length) return NextResponse.json({ error: recErr?.message ?? 'Enregistrement impossible' }, { status: 500 })
    // Boutique : un seul e-mail d'information à la RH (pas un par semaine).
    if (ctx.isBoutique) await sendRhRequestMail(supabase, rows[0].id, 'info')
    return NextResponse.json({ success: true, id: rows[0].id, autoValidated: true, count: rows.length, skipped: periods.length - fresh.length })
  }

  const { data, error } = await supabase
    .from('absences')
    .insert({
      user_id: requesterId,
      type,
      start_date,
      end_date,
      start_period: start_period ?? 'full',
      end_period: end_period ?? 'full',
      reason: reason?.trim() || null,
      status: autoValidated ? 'Validé' : 'En attente',
      reviewed_by: autoValidated ? requesterId : null,
      reviewed_at: autoValidated ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Boutique : la RH est prévenue TOUT DE SUITE, depuis le serveur (jamais perdu si l'onglet se ferme) :
  // demande à valider (congés payés / RTT) ou information (alternance, absence signalée).
  // Absence signalée AVEC justificatif : le mail part une fois le fichier enregistré (route attachment), pour le contenir.
  const mailAfterUpload = autoValidated && has_file === true && (type === 'Maladie' || type === 'Autre')
  if (ctx.isBoutique && !mailAfterUpload) await sendRhRequestMail(supabase, data.id, autoValidated ? 'info' : 'new')
  return NextResponse.json({ success: true, id: data.id, autoValidated })
}
