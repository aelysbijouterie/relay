import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRecentMails, imapConfig } from './imap'
import { analyzeMails, type MailAction } from './analyze'
import { cleanBody, parseExclude, skipReason, type CardStatus, type RawMail } from './filter'
import { sendEmail } from '@/lib/email'
import { baseHtml, button, esc } from '@/emails/baseHtml'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aelys-relays.vercel.app'
const BATCH = 3

export interface Owner { id: string; name: string; email: string; department_id: string | null }

/** Propriétaire de la boîte lue : le profil RELAYS qui porte la même adresse e-mail. */
export async function getMailOwner(supabase: SupabaseClient): Promise<Owner | null> {
  const addr = process.env.MAIL_IMAP_USER
  if (!addr) return null
  const { data } = await supabase.from('profiles').select('id, name, email, department_id').ilike('email', addr).eq('is_boutique_account', false).limit(1)
  return (data?.[0] as Owner | undefined) ?? null
}

/** Crée la carte RELAYS (au nom du propriétaire, assignée à lui-même) à partir d'une action proposée. */
export async function createCardFromAction(
  supabase: SupabaseClient, owner: Owner,
  a: { title: string; description: string | null; priority: string; deadline: string | null; from: string; subject: string; received: string | null; status?: CardStatus },
): Promise<string | null> {
  if (!owner.department_id) return null
  const origin = `📧 Origine : mail de ${a.from} — « ${a.subject} »${a.received ? ` (${a.received.slice(0, 10)})` : ''}`
  const { data: task, error } = await supabase.from('tasks').insert({
    title: a.title.slice(0, 200),
    description: [a.description?.trim(), origin].filter(Boolean).join('\n\n'),
    status: a.status ?? 'A Faire', priority: a.priority, department_id: owner.department_id,
    deadline: a.deadline, created_by: owner.id, is_cross_team: false,
  }).select('id').single()
  if (error || !task) return null
  await supabase.from('task_assignees').insert({ task_id: task.id, user_id: owner.id })
  return task.id as string
}

export interface ScanResult {
  ok: boolean; error?: string
  read: number; skipped: number; analysed: number; withoutAction: number
  proposed: number; created: number; retryLater: number; readIgnored?: number; scanned?: number; candidates?: number; todoCards?: number; moved?: number; aiError?: string
}

export interface ScanOptions {
  /** Importation des mails déjà marqués « à traiter » / « en cours » (toute la boîte, 1 an). */
  backfill?: boolean
  /** Envoie le récapitulatif quotidien par e-mail (uniquement le passage de 8 h). */
  digest?: boolean
}

/**
 * Passage complet : lit la boîte, écarte le bruit, analyse le reste avec l'IA, enregistre les propositions
 * (ou crée directement les cartes si MAIL_AUTO_CREATE=true), puis prévient par e-mail.
 * Un mail n'est jamais traité deux fois ; un lot dont l'analyse échoue est simplement retenté au passage suivant.
 */
export async function runMailScan(supabase: SupabaseClient, opts: ScanOptions = {}): Promise<ScanResult> {
  const scanStart = Date.now()
  const deadline = scanStart + 52000 // la fonction dispose de 60 s
  const res: ScanResult = { ok: false, read: 0, skipped: 0, analysed: 0, withoutAction: 0, proposed: 0, created: 0, retryLater: 0 }
  if (!imapConfig()) return { ...res, error: 'Connexion mail non configurée dans Vercel' }
  const owner = await getMailOwner(supabase)
  if (!owner) return { ...res, error: 'Aucun profil RELAYS ne porte l’adresse de la boîte lue (MAIL_IMAP_USER)' }
  // Les cartes sont créées directement (sans validation), sauf si MAIL_AUTO_CREATE vaut « false ».
  const auto = process.env.MAIL_AUTO_CREATE !== 'false'
  const exclude = parseExclude(process.env.MAIL_EXCLUDE)

  let mails: RawMail[]
  try {
    const r = await fetchRecentMails({
      days: opts.backfill ? 365 : 3, max: 40, markedOnly: !!opts.backfill,
      isSeen: async ids => {
        const { data } = await supabase.from('mail_suggestions').select('message_id').in('message_id', ids)
        return new Set((data ?? []).map((x: { message_id: string }) => x.message_id))
      },
    })
    mails = r.mails; res.readIgnored = r.readIgnored; res.scanned = r.scanned; res.candidates = r.candidates
    // Avancement des cartes déjà créées : un mail marqué « en cours » (ou « terminé ») fait passer sa carte dans la bonne colonne.
    if (!opts.backfill) res.moved = await syncCardStatuses(supabase, r.states)
  } catch (e) { return { ...res, error: e instanceof Error ? e.message : 'Lecture de la boîte impossible' } }
  res.read = mails.length

  const { data: seen } = await supabase.from('mail_suggestions').select('message_id').in('message_id', mails.map(m => m.messageId))
  const seenIds = new Set((seen ?? []).map((s: { message_id: string }) => s.message_id))
  const fresh = mails.filter(m => !seenIds.has(m.messageId))

  const toAnalyse: RawMail[] = []
  const noneRows: { message_id: string; owner_id: string; status: string; received_at: string }[] = []
  for (const m of fresh) {
    if (skipReason(m, process.env.MAIL_IMAP_USER ?? '', exclude)) {
      res.skipped++
      noneRows.push({ message_id: m.messageId, owner_id: owner.id, status: 'none', received_at: m.date.toISOString() })
    } else toAnalyse.push(m)
  }

  const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())

  // Petits lots traités EN PARALLÈLE (4 appels à la fois) : chaque appel reste court, l'ensemble tient dans le temps imparti.
  const batches: RawMail[][] = []
  for (let i = 0; i < toAnalyse.length; i += BATCH) batches.push(toAnalyse.slice(i, i + BATCH))

  async function saveBatch(batch: RawMail[], analyses: Awaited<ReturnType<typeof analyzeMails>>) {
    const byIdx = new Map(analyses.map(a => [a.index, a.actions]))
    for (let k = 0; k < batch.length; k++) {
      const m = batch[k]
      let actions: MailAction[] | undefined = byIdx.get(k)
      if (!actions) { res.retryLater++; continue } // l'IA n'a pas répondu pour ce mail : retenté plus tard
      // Mail marqué « à traiter » : une carte est TOUJOURS créée, même si l'IA ne voit pas d'action précise.
      if (m.todo && actions.length === 0) actions = [{ title: `Traiter : ${m.subject}`.slice(0, 150), description: cleanBody(m.text, 800), priority: 'Moyenne', deadline: null }]
      res.analysed++
      if (actions.length === 0) {
        res.withoutAction++
        noneRows.push({ message_id: m.messageId, owner_id: owner!.id, status: 'none', received_at: m.date.toISOString() })
        continue
      }
      const from = m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail
      for (let n = 0; n < actions.length; n++) {
        const a = actions[n]
        let status = 'pending'; let taskId: string | null = null
        if (auto || m.todo) { // les mails marqués « à traiter » deviennent des cartes sans validation
          taskId = await createCardFromAction(supabase, owner!, { ...a, from, subject: m.subject, received: m.date.toISOString(), status: m.target === 'En cours' ? 'En cours' : 'A Faire' })
          if (taskId) { status = 'created'; res.created++; if (m.todo) res.todoCards = (res.todoCards ?? 0) + 1 } else res.proposed++
        } else res.proposed++
        await supabase.from('mail_suggestions').upsert({
          message_id: m.messageId, action_idx: n, owner_id: owner!.id, status,
          from_name: m.fromName, from_email: m.fromEmail, subject: m.subject, received_at: m.date.toISOString(),
          title: a.title, description: a.description, priority: a.priority, deadline: a.deadline, task_id: taskId,
        }, { onConflict: 'message_id,action_idx' })
      }
    }
  }

  const PARALLEL = 4
  for (let i = 0; i < batches.length; i += PARALLEL) {
    const round = batches.slice(i, i + PARALLEL)
    const left = batches.slice(i).reduce((n, b) => n + b.length, 0)
    // La fonction dispose de 60 s : on ne démarre pas un tour s'il reste trop peu de temps, le reste sera repris plus tard.
    if (Date.now() > deadline - 15000) { res.retryLater += left; res.aiError = res.aiError ?? 'Temps écoulé : le reste sera analysé au prochain passage'; break }
    const out = await Promise.allSettled(round.map(batch => analyzeMails(batch, today, deadline)))
    let failed = 0
    for (let k = 0; k < round.length; k++) {
      const r = out[k]
      if (r.status === 'fulfilled') await saveBatch(round[k], r.value)
      else { failed++; res.retryLater += round[k].length; res.aiError = r.reason instanceof Error ? r.reason.message : 'Erreur IA inconnue' }
    }
    if (noneRows.length) { await supabase.from('mail_suggestions').upsert(noneRows.splice(0).map(r => ({ ...r, action_idx: 0 })), { onConflict: 'message_id,action_idx' }) }
    // Tous les appels du tour ont échoué (clé, quota, panne) : inutile d'insister.
    if (failed === round.length) { res.retryLater += batches.slice(i + PARALLEL).reduce((n, b) => n + b.length, 0); break }
  }

  if (noneRows.length) await supabase.from('mail_suggestions').upsert(noneRows.map(r => ({ ...r, action_idx: 0 })), { onConflict: 'message_id,action_idx' })

  if (opts.digest) await sendDailyDigest(supabase, owner, auto)

  return { ...res, ok: true }
}

const STATUS_RANK: Record<string, number> = { 'A Faire': 0, 'En cours': 1, 'A revoir': 2, 'Terminé': 3 }

/**
 * Fait avancer les cartes créées depuis un mail : si la marque du mail est maintenant « en cours », la carte passe en « En cours » ;
 * « terminé / clos / fini » → « Terminé ». Une carte ne recule jamais (un mail marqué « à traiter » ne ramène pas une carte avancée en arrière).
 */
export async function syncCardStatuses(supabase: SupabaseClient, states: Map<string, { target: CardStatus | null }>): Promise<number> {
  const ids = [...states.entries()].filter(([, st]) => st.target === 'En cours' || st.target === 'Terminé').map(([id]) => id)
  if (ids.length === 0) return 0
  const { data: sug } = await supabase.from('mail_suggestions').select('message_id, task_id').in('message_id', ids).not('task_id', 'is', null)
  const links = (sug ?? []) as { message_id: string; task_id: string }[]
  if (links.length === 0) return 0
  const { data: tasks } = await supabase.from('tasks').select('id, status').in('id', links.map(l => l.task_id)).is('deleted_at', null)
  const current = new Map((tasks ?? []).map((t: { id: string; status: string }) => [t.id, t.status]))
  let moved = 0
  for (const l of links) {
    const target = states.get(l.message_id)?.target
    const now = current.get(l.task_id)
    if (!target || !now || (STATUS_RANK[target] ?? 0) <= (STATUS_RANK[now] ?? 99)) continue
    const patch: Record<string, unknown> = { status: target, updated_at: new Date().toISOString() }
    if (target === 'Terminé') patch.completed_at = new Date().toISOString()
    const { error } = await supabase.from('tasks').update(patch).eq('id', l.task_id)
    if (!error) moved++
  }
  return moved
}

/** Récapitulatif du matin : tout ce que RELAYS a repéré depuis la veille (une seule fois par jour, jamais à chaque passage de 30 min). */
async function sendDailyDigest(supabase: SupabaseClient, owner: Owner, auto: boolean) {
  // Une seule fois par jour, même si le passage horaire de Vercel est décalé (offre Hobby : l'heure exacte n'est pas garantie).
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())
  const marker = `digest-${day}`
  const { data: done } = await supabase.from('mail_suggestions').select('id').eq('message_id', marker).limit(1)
  if (done && done.length > 0) return
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data } = await supabase.from('mail_suggestions')
    .select('title, from_name, from_email, subject, status')
    .eq('owner_id', owner.id).in('status', ['pending', 'created']).gte('created_at', since).order('created_at', { ascending: false }).limit(40)
  const items = (data ?? []) as { title: string; from_name: string | null; from_email: string | null; subject: string | null; status: string }[]
  if (items.length === 0) return
  await supabase.from('mail_suggestions').upsert({ message_id: marker, action_idx: 0, owner_id: owner.id, status: 'none' }, { onConflict: 'message_id,action_idx' })
  const pending = items.filter(i => i.status === 'pending').length
  const rows = items.map(n => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;"><strong>${esc(n.title)}</strong>${n.status === 'created' ? ' <span style="color:#1F9D57;font-size:12px;">carte créée</span>' : ''}<br><span style="color:#6B7280;font-size:12px;">${esc(n.from_name || n.from_email)} — ${esc(n.subject)}</span></td></tr>`).join('')
  const head = pending > 0 ? `${pending} action(s) à valider, ${items.length - pending} carte(s) créée(s) depuis hier` : `${items.length} carte(s) créée(s) à partir de vos mails depuis hier`
  await sendEmail({
    to: owner.email,
    subject: `📧 ${head}`,
    html: baseHtml({
      title: head, preheader: head, prefLabel: 'Mails à traiter',
      content: `<p style="font-size:15px;">Bonjour ${esc(owner.name.split(' ')[0])}, voici ce que RELAYS a repéré dans vos mails :</p><table width="100%" cellpadding="0" cellspacing="0">${rows}</table><p style="margin-top:18px;">${button({ label: pending > 0 || !auto ? 'Valider mes actions' : 'Voir mes cartes', color: '#7E6FB0', href: `${APP_URL}${pending > 0 || !auto ? '/mails' : '/kanban'}` })}</p>`,
    }),
  })
}
