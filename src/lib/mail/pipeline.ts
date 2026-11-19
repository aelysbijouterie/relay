import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRecentMails, imapConfig } from './imap'
import { analyzeMails, type MailAction } from './analyze'
import { cleanBody, parseExclude, skipReason, type RawMail } from './filter'
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
  a: { title: string; description: string | null; priority: string; deadline: string | null; from: string; subject: string; received: string | null },
): Promise<string | null> {
  if (!owner.department_id) return null
  const origin = `📧 Origine : mail de ${a.from} — « ${a.subject} »${a.received ? ` (${a.received.slice(0, 10)})` : ''}`
  const { data: task, error } = await supabase.from('tasks').insert({
    title: a.title.slice(0, 200),
    description: [a.description?.trim(), origin].filter(Boolean).join('\n\n'),
    status: 'A Faire', priority: a.priority, department_id: owner.department_id,
    deadline: a.deadline, created_by: owner.id, is_cross_team: false,
  }).select('id').single()
  if (error || !task) return null
  await supabase.from('task_assignees').insert({ task_id: task.id, user_id: owner.id })
  return task.id as string
}

export interface ScanResult {
  ok: boolean; error?: string
  read: number; skipped: number; analysed: number; withoutAction: number
  proposed: number; created: number; retryLater: number; readIgnored?: number; todoCards?: number; aiError?: string
}

/**
 * Passage complet : lit la boîte, écarte le bruit, analyse le reste avec l'IA, enregistre les propositions
 * (ou crée directement les cartes si MAIL_AUTO_CREATE=true), puis prévient par e-mail.
 * Un mail n'est jamais traité deux fois ; un lot dont l'analyse échoue est simplement retenté au passage suivant.
 */
export async function runMailScan(supabase: SupabaseClient): Promise<ScanResult> {
  const scanStart = Date.now()
  const deadline = scanStart + 52000 // la fonction dispose de 60 s
  const res: ScanResult = { ok: false, read: 0, skipped: 0, analysed: 0, withoutAction: 0, proposed: 0, created: 0, retryLater: 0 }
  if (!imapConfig()) return { ...res, error: 'Connexion mail non configurée dans Vercel' }
  const owner = await getMailOwner(supabase)
  if (!owner) return { ...res, error: 'Aucun profil RELAYS ne porte l’adresse de la boîte lue (MAIL_IMAP_USER)' }
  const auto = process.env.MAIL_AUTO_CREATE === 'true'
  const exclude = parseExclude(process.env.MAIL_EXCLUDE)

  let mails: RawMail[]
  try {
    const r = await fetchRecentMails(3, 40)
    mails = r.mails; res.readIgnored = r.readIgnored
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
  const newItems: { title: string; from: string; subject: string; created: boolean }[] = []

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
          taskId = await createCardFromAction(supabase, owner!, { ...a, from, subject: m.subject, received: m.date.toISOString() })
          if (taskId) { status = 'created'; res.created++; if (m.todo) res.todoCards = (res.todoCards ?? 0) + 1 } else res.proposed++
        } else res.proposed++
        await supabase.from('mail_suggestions').upsert({
          message_id: m.messageId, action_idx: n, owner_id: owner!.id, status,
          from_name: m.fromName, from_email: m.fromEmail, subject: m.subject, received_at: m.date.toISOString(),
          title: a.title, description: a.description, priority: a.priority, deadline: a.deadline, task_id: taskId,
        }, { onConflict: 'message_id,action_idx' })
        newItems.push({ title: a.title, from: m.fromName || m.fromEmail, subject: m.subject, created: status === 'created' })
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

  if (newItems.length > 0) {
    const rows = newItems.map(n => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;font-size:14px;"><strong>${esc(n.title)}</strong><br><span style="color:#6B7280;font-size:12px;">${esc(n.from)} — ${esc(n.subject)}</span></td></tr>`).join('')
    const head = auto ? `${newItems.length} carte(s) créée(s) à partir de vos mails` : `${newItems.length} action(s) à valider`
    await sendEmail({
      to: owner.email,
      subject: `📧 ${head}`,
      html: baseHtml({
        title: head, preheader: head, prefLabel: 'Mails à traiter',
        content: `<p style="font-size:15px;">Bonjour ${esc(owner.name.split(' ')[0])}, voici ce que RELAYS a repéré dans vos mails :</p><table width="100%" cellpadding="0" cellspacing="0">${rows}</table><p style="margin-top:18px;">${button({ label: auto ? 'Voir mes cartes' : 'Valider mes actions', color: '#7E6FB0', href: `${APP_URL}${auto ? '/kanban' : '/mails'}` })}</p>`,
      }),
    })
  }

  return { ...res, ok: true }
}
