import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { baseHtml, button, esc } from '@/emails/baseHtml'
import { listTempoOperations, tempoConfig, upsertTempoOperation } from './client'
import {
  SUBTASK_RULES, buildCgvText, dateConflict, fillDescription, formatOperationTitle, nextStep, normalizeName, parseOperationName,
  type TempoOperation,
} from './logic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'
const TEMPLATE_NAME = 'OPÉRATION COMMERCIALE'

interface Card {
  id: string; title: string; description: string | null; deadline: string | null; status: string
  op_category: string | null; op_date_debut: string | null; op_date_fin: string | null; op_mecanique: string | null; op_cgv: string | null
}
interface Link { task_id: string; tempo_operation_id: string; conflict: string | null; conflict_notified: string | null; pushed_state: string | null }
interface Owner { id: string; name: string; email: string; department_id: string | null }

export interface TempoSyncResult {
  ok: boolean; error?: string
  linked: number; createdInTempo: number; createdInRelays: number; updatedCards: number; conflicts: number
  notes: string[]
}

const CARD_COLS = 'id, title, description, deadline, status, op_category, op_date_debut, op_date_fin, op_mecanique, op_cgv'
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : null)

async function findOwner(supabase: SupabaseClient): Promise<Owner | null> {
  const email = process.env.TEMPO_CARD_OWNER_EMAIL || process.env.MAIL_IMAP_USER || 'manon.mignot@aelys.fr'
  const { data } = await supabase.from('profiles').select('id, name, email, department_id').ilike('email', email).limit(1)
  return (data?.[0] as Owner | undefined) ?? null
}

/** Cartes « opération commerciale » : catégorie, titre du modèle, ou liste à cocher du modèle. */
async function loadOperationCards(supabase: SupabaseClient): Promise<Card[]> {
  const byId = new Map<string, Card>()
  const add = (rows: unknown) => { for (const c of (rows ?? []) as Card[]) byId.set(c.id, c) }
  const base = () => supabase.from('tasks').select(CARD_COLS).is('deleted_at', null).is('parent_task_id', null).neq('status', 'Archivé')
  add((await base().or(`op_category.eq.operation_commerciale,title.ilike.${TEMPLATE_NAME}%`)).data)
  const { data: subs } = await supabase.from('task_subtasks').select('task_id').ilike('title', 'Réalisation des visuels')
  const ids = [...new Set((subs ?? []).map((s: { task_id: string }) => s.task_id))].filter(id => !byId.has(id))
  if (ids.length) add((await base().in('id', ids)).data)
  return [...byId.values()]
}

async function loadTemplate(supabase: SupabaseClient) {
  const { data } = await supabase.from('task_templates').select('default_description, default_priority, default_subtasks').ilike('name', `${TEMPLATE_NAME}%`).limit(1)
  return (data?.[0] ?? null) as { default_description: string | null; default_priority: string | null; default_subtasks: { title: string; group?: string }[] | null } | null
}

/**
 * Synchronisation RELAYS ⇄ Tempo (sans aucun e-mail automatique vers l'extérieur : seule la responsable est prévenue d'une dissonance).
 *  1. rapproche cartes et opérations (lien enregistré, sinon même nom) ;
 *  2. opération Tempo sans carte → carte RELAYS ; carte RELAYS sans opération → opération Tempo ;
 *  3. dates différentes → dissonance (rouge dans RELAYS et Tempo + e-mail), rien n'est écrasé ;
 *  4. Tempo → RELAYS : CGV, mécanique (si vide), échéance de l'étape en cours, échéances et cases des sous-tâches.
 */
export async function runTempoSync(supabase: SupabaseClient): Promise<TempoSyncResult> {
  const res: TempoSyncResult = { ok: false, linked: 0, createdInTempo: 0, createdInRelays: 0, updatedCards: 0, conflicts: 0, notes: [] }
  if (!tempoConfig()) return { ...res, error: 'Liaison Tempo non configurée : ajoutez TEMPO_URL et TEMPO_SYNC_SECRET dans Vercel' }
  const owner = await findOwner(supabase)
  if (!owner?.department_id) return { ...res, error: 'Profil propriétaire des cartes introuvable (TEMPO_CARD_OWNER_EMAIL)' }

  const linksQ = await supabase.from('tempo_links').select('task_id, tempo_operation_id, conflict, conflict_notified, pushed_state')
  if (linksQ.error) return { ...res, error: 'Migration 034 (table tempo_links) à exécuter dans Supabase' }
  const links = new Map<string, Link>(((linksQ.data ?? []) as Link[]).map(l => [l.task_id, l]))
  const linkedOps = new Set([...links.values()].map(l => l.tempo_operation_id))

  let ops: TempoOperation[]
  try { ops = await listTempoOperations() } catch (e) { return { ...res, error: e instanceof Error ? e.message : 'Tempo injoignable' } }
  const opsById = new Map(ops.map(o => [o.id, o]))
  const cards = await loadOperationCards(supabase)
  const cardsById = new Map(cards.map(c => [c.id, c]))
  const tpl = await loadTemplate(supabase)

  async function saveLink(taskId: string, opId: string) {
    const row = { task_id: taskId, tempo_operation_id: opId, synced_at: new Date().toISOString() }
    const { error } = await supabase.from('tempo_links').upsert(row, { onConflict: 'task_id' })
    if (error) { res.notes.push(`Lien non enregistré (${error.message})`); return false }
    links.set(taskId, { task_id: taskId, tempo_operation_id: opId, conflict: null, conflict_notified: null, pushed_state: null })
    linkedOps.add(opId)
    return true
  }

  // 1. Rapprochement
  for (const op of ops) {
    if (linkedOps.has(op.id)) continue
    let card = op.relays_task_id ? cardsById.get(op.relays_task_id) : undefined
    if (card && links.has(card.id)) card = undefined
    if (!card) {
      const same = cards.filter(c => !links.has(c.id) && normalizeName(parseOperationName(c.title)) === normalizeName(op.nom))
      card = same.find(c => op.date_debut && day(c.op_date_debut) === op.date_debut) ?? (same.length === 1 ? same[0] : undefined)
    }
    if (card) await saveLink(card.id, op.id)
  }

  // 2a. Opération Tempo sans carte → carte RELAYS (modèle, liste à cocher, CGV, mécanique…)
  for (const op of ops) {
    if (linkedOps.has(op.id)) continue
    const cgv = buildCgvText(op.cgv_magasin, op.cgv_web)
    const description = fillDescription(tpl?.default_description ?? "Mécanique de l'opération :\nCGV :", op.mecanique, cgv)
    const { data: task, error } = await supabase.from('tasks').insert({
      title: formatOperationTitle(op.nom, op.date_debut, op.date_fin).slice(0, 200), description, status: 'A Faire',
      priority: tpl?.default_priority ?? 'Moyenne', department_id: owner.department_id, created_by: owner.id, is_cross_team: false,
      op_category: 'operation_commerciale', op_date_debut: op.date_debut, op_date_fin: op.date_fin,
      op_mecanique: op.mecanique?.trim() || null, op_cgv: cgv || null,
    }).select(CARD_COLS).single()
    if (error || !task) { res.notes.push(`Carte non créée pour « ${op.nom} » (${error?.message ?? 'erreur'})`); continue }
    await supabase.from('task_assignees').insert({ task_id: task.id, user_id: owner.id })
    const subs = tpl?.default_subtasks ?? []
    if (subs.length) await supabase.from('task_subtasks').insert(subs.map((s, i) => ({ task_id: task.id, title: s.title, group_name: s.group ?? 'Général', position: i, is_done: false, created_by: owner.id })))
    cards.push(task as Card); cardsById.set(task.id, task as Card)
    if (!(await saveLink(task.id, op.id))) {
      // Une autre synchronisation vient de créer cette carte : on retire le doublon.
      await supabase.from('tasks').delete().eq('id', task.id)
      cards.pop(); cardsById.delete(task.id)
    } else {
      res.createdInRelays++
      try { await upsertTempoOperation({ relays_task_id: task.id, tempo_operation_id: op.id, nom: op.nom, date_debut: op.date_debut, date_fin: op.date_fin, mecanique: op.mecanique, relays: { date_debut: op.date_debut, date_fin: op.date_fin, conflit: null } }) }
      catch (e) { res.notes.push(`Lien non transmis à Tempo pour « ${op.nom} » : ${e instanceof Error ? e.message : 'erreur'}`) }
    }
  }

  // 2b. Carte RELAYS sans opération → opération Tempo
  for (const c of cards) {
    if (links.has(c.id)) continue
    const start = day(c.op_date_debut); const end = day(c.op_date_fin)
    const nom = parseOperationName(c.title)
    if (!start || !end || /\[date\]/i.test(c.title) || nom.length < 3) { res.notes.push(`« ${c.title} » : renseignez le titre et les dates de début et de fin pour l’envoyer vers Tempo`); continue }
    try {
      const { id } = await upsertTempoOperation({ relays_task_id: c.id, nom, date_debut: start, date_fin: end, mecanique: c.op_mecanique, relays: { date_debut: start, date_fin: end, conflit: null } })
      if (await saveLink(c.id, id)) res.createdInTempo++
    } catch (e) { res.notes.push(`« ${c.title} » non envoyée à Tempo : ${e instanceof Error ? e.message : 'erreur'}`) }
  }

  // 3 et 4. Cartes liées
  const linkedIds = [...links.keys()].filter(id => cardsById.has(id) && opsById.has(links.get(id)!.tempo_operation_id))
  res.linked = linkedIds.length
  const { data: subRows } = linkedIds.length
    ? await supabase.from('task_subtasks').select('id, task_id, title, is_done, deadline').in('task_id', linkedIds)
    : { data: [] as { id: string; task_id: string; title: string; is_done: boolean; deadline: string | null }[] }
  const subsByTask = new Map<string, { id: string; title: string; is_done: boolean; deadline: string | null }[]>()
  for (const s of (subRows ?? []) as { id: string; task_id: string; title: string; is_done: boolean; deadline: string | null }[]) {
    const arr = subsByTask.get(s.task_id) ?? []; arr.push(s); subsByTask.set(s.task_id, arr)
  }
  const newConflicts: { title: string; text: string; taskId: string }[] = []

  for (const id of linkedIds) {
    const card = cardsById.get(id)!; const link = links.get(id)!; const op = opsById.get(link.tempo_operation_id)!
    const patch: Record<string, unknown> = {}

    // Dates de l'opération : on ne remplit que si la carte n'en a pas ; sinon, en cas de différence, c'est une dissonance (rien n'est écrasé).
    if (!card.op_date_debut && op.date_debut) patch.op_date_debut = op.date_debut
    if (!card.op_date_fin && op.date_fin) patch.op_date_fin = op.date_fin
    const conflict = dateConflict({ debut: day(card.op_date_debut), fin: day(card.op_date_fin) }, { debut: op.date_debut, fin: op.date_fin })

    const cgv = buildCgvText(op.cgv_magasin, op.cgv_web)
    if (cgv && cgv !== (card.op_cgv ?? '')) patch.op_cgv = cgv
    if (!card.op_mecanique?.trim() && op.mecanique?.trim()) patch.op_mecanique = op.mecanique.trim()
    const desc = fillDescription(card.description, op.mecanique, cgv)
    if (desc !== (card.description ?? '')) patch.description = desc

    const step = nextStep(op)
    if (step && day(card.deadline) !== step.date && card.status !== 'Terminé') patch.deadline = step.date

    if (Object.keys(patch).length) {
      const { error } = await supabase.from('tasks').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) res.notes.push(`« ${card.title} » non mise à jour (${error.message})`); else res.updatedCards++
    }

    for (const s of subsByTask.get(id) ?? []) {
      const rule = SUBTASK_RULES[normalizeName(s.title)]
      if (!rule) continue
      const sp: Record<string, unknown> = {}
      const date = op.echeances[rule.deadline]
      if (date && day(s.deadline) !== day(date)) sp.deadline = `${day(date)}T12:00:00+00:00`
      if (rule.done(op) && !s.is_done) sp.is_done = true // une case n'est jamais décochée par Tempo
      if (Object.keys(sp).length) await supabase.from('task_subtasks').update(sp).eq('id', s.id)
    }

    // Dissonance : visible dans RELAYS (rouge), transmise à Tempo (rouge aussi), e-mail une seule fois par dissonance.
    const state = JSON.stringify([day(card.op_date_debut), day(card.op_date_fin), conflict])
    if (state !== link.pushed_state) {
      try {
        await upsertTempoOperation({ relays_task_id: id, tempo_operation_id: op.id, nom: op.nom, date_debut: op.date_debut, date_fin: op.date_fin, mecanique: op.mecanique, relays: { date_debut: day(card.op_date_debut), date_fin: day(card.op_date_fin), conflit: conflict } })
        link.pushed_state = state
      } catch (e) { res.notes.push(`« ${card.title} » : Tempo n’a pas reçu les dates RELAYS (${e instanceof Error ? e.message : 'erreur'})`) }
    }
    if (conflict) {
      res.conflicts++
      if (link.conflict_notified !== conflict) newConflicts.push({ title: card.title, text: conflict, taskId: id })
    }
    await supabase.from('tempo_links').update({
      conflict, pushed_state: link.pushed_state, synced_at: new Date().toISOString(),
      conflict_notified: conflict ? link.conflict_notified : null,
    }).eq('task_id', id)
  }

  if (newConflicts.length) {
    try {
      const rows = newConflicts.map(n => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;"><strong>${esc(n.title)}</strong><br><span style="color:#EF4444;font-size:13px;">${esc(n.text)}</span></td></tr>`).join('')
      const head = `${newConflicts.length} opération(s) avec des dates différentes entre RELAYS et Tempo`
      await sendEmail({
        to: owner.email, subject: `🔴 ${head}`,
        html: baseHtml({ title: head, preheader: head, prefLabel: 'Liaison Tempo', mandatory: true,
          content: `<p style="font-size:15px;">Bonjour ${esc(owner.name.split(' ')[0])}, les dates ci-dessous ne sont pas les mêmes dans RELAYS et dans Tempo. Rien n’a été modifié : corrigez la bonne plateforme (les deux affichent l’opération en rouge jusqu’à la correction).</p><table width="100%" cellpadding="0" cellspacing="0">${rows}</table><p style="margin-top:18px;">${button({ label: 'Voir les opérations', color: '#EF4444', href: `${APP_URL}/pac-media-kit` })}</p>` }),
      })
      for (const n of newConflicts) await supabase.from('tempo_links').update({ conflict_notified: n.text }).eq('task_id', n.taskId)
    } catch { res.notes.push('E-mail de dissonance non envoyé') }
  }

  return { ...res, ok: true }
}
