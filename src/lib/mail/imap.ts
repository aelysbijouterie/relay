import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { targetStatus, type CardStatus, type RawMail } from './filter'

export function imapConfig() {
  const host = process.env.MAIL_IMAP_HOST
  const user = process.env.MAIL_IMAP_USER
  const pass = process.env.MAIL_IMAP_PASSWORD
  return host && user && pass ? { host, user, pass } : null
}

function headerMap(h: Map<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of h) out[k.toLowerCase()] = typeof v === 'string' ? v : Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(typeof v === 'object' && 'value' in (v as object) ? (v as { value: unknown }).value : v)
  return out
}

const newClient = (cfg: { host: string; user: string; pass: string }) =>
  new ImapFlow({ host: cfg.host, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })

export interface MailState { unread: boolean; answered: boolean; flagged: boolean; marks: string[]; target: CardStatus | null }
interface FlagInfo { flags: Set<string>; messageId: string | null }

/** Étape légère : l'état (lu, répondu, drapeau, catégories) et l'identifiant de tous les mails récents, sans télécharger leur contenu. */
async function readFlags(client: ImapFlow, uids: number[]): Promise<Map<number, FlagInfo>> {
  const out = new Map<number, FlagInfo>()
  if (uids.length === 0) return out
  for await (const msg of client.fetch(uids, { uid: true, flags: true, envelope: true }, { uid: true })) {
    out.set(msg.uid, { flags: new Set(msg.flags ?? []), messageId: msg.envelope?.messageId?.trim() || null })
  }
  return out
}

function describeFlags(flags: Set<string>): MailState {
  const marks = [...flags].filter(f => !f.startsWith('\\') && !f.startsWith('$'))
  const flagged = flags.has('\\Flagged')
  return { unread: !flags.has('\\Seen'), answered: flags.has('\\Answered'), flagged, marks, target: targetStatus(flagged, marks) }
}

export interface FetchOptions {
  days?: number
  max?: number
  /** Importation : ne prend que les mails MARQUÉS (« à traiter » / « en cours » / drapeau), quel que soit leur état lu ou répondu. */
  markedOnly?: boolean
  /** Renvoie, parmi ces identifiants, ceux déjà traités : ils ne sont pas téléchargés. */
  isSeen?: (ids: string[]) => Promise<Set<string>>
}

/**
 * Lit les mails de la boîte de réception (lecture seule : rien n'est modifié, déplacé ni marqué comme lu).
 * Un mail est « à traiter » s'il est NON LU ou marqué (« à traiter » / « en cours » / drapeau). Ouvert sans marque ou marqué « terminé » : ignoré.
 * `states` donne l'état actuel de tous les mails récents (sert à faire avancer les cartes déjà créées).
 */
export async function fetchRecentMails(opts: FetchOptions = {}): Promise<{ mails: RawMail[]; scanned: number; candidates: number; readIgnored: number; states: Map<string, MailState> }> {
  const { days = 3, max = 40, markedOnly = false, isSeen } = opts
  const cfg = imapConfig()
  if (!cfg) throw new Error('Connexion mail non configurée (MAIL_IMAP_HOST / USER / PASSWORD)')
  const client = newClient(cfg)
  const mails: RawMail[] = []
  const states = new Map<string, MailState>()
  let scanned = 0; let readIgnored = 0; let candidates = 0
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const found = await client.search({ since: new Date(Date.now() - days * 86400000) }, { uid: true })
      const all = (found || []).sort((a, b) => b - a).slice(0, markedOnly ? 3000 : 300)
      scanned = all.length
      const info = await readFlags(client, all)
      let wanted: number[] = []
      for (const uid of all) {
        const fi = info.get(uid)
        if (!fi) continue
        const st = describeFlags(fi.flags)
        if (fi.messageId) states.set(fi.messageId, st)
        const marked = st.target === 'A Faire' || st.target === 'En cours'
        // Marqué « terminé » : jamais de carte. Sinon : marqué « à traiter / en cours » OU non lu. Un mail déjà ouvert (sans marque) est ignoré.
        if (st.target === 'Terminé') continue
        if (markedOnly ? marked : (marked || st.unread)) wanted.push(uid)
      }
      readIgnored = all.length - wanted.length
      candidates = wanted.length
      if (isSeen) {
        const ids = wanted.map(u => info.get(u)?.messageId).filter((x): x is string => !!x)
        const seen = ids.length ? await isSeen(ids) : new Set<string>()
        wanted = wanted.filter(u => { const id = info.get(u)?.messageId; return !id || !seen.has(id) })
      }
      const uids = wanted.slice(0, max)
      if (uids.length === 0) return { mails: [], scanned, candidates, readIgnored, states }
      for await (const msg of client.fetch(uids, { uid: true, internalDate: true, source: { maxLength: 60000 } }, { uid: true })) {
        if (!msg.source) continue
        try {
          const p = await simpleParser(msg.source)
          const from = p.from?.value?.[0]
          const fi = info.get(msg.uid)
          const st = describeFlags(fi?.flags ?? new Set())
          mails.push({
            messageId: (p.messageId ?? fi?.messageId ?? `uid-${cfg.user}-${msg.uid}-${new Date(msg.internalDate ?? Date.now()).getTime()}`).trim(),
            fromName: from?.name ?? '',
            fromEmail: (from?.address ?? '').toLowerCase(),
            subject: (p.subject ?? '(sans objet)').trim(),
            date: p.date ?? new Date(msg.internalDate ?? Date.now()),
            text: p.text || (typeof p.html === 'string' ? p.html : ''),
            headers: headerMap(p.headers as unknown as Map<string, unknown>),
            unread: st.unread, answered: st.answered,
            todo: st.target === 'A Faire' || st.target === 'En cours',
            target: st.target,
          })
        } catch { /* mail illisible : ignoré */ }
      }
    } finally { lock.release() }
  } finally { await client.logout().catch(() => { /* noop */ }) }
  return { mails: mails.sort((a, b) => b.date.getTime() - a.date.getTime()), scanned, candidates, readIgnored, states }
}

export interface ConnectionReport {
  ok: true; count: number; unread: number; unanswered: number; todo: number
  marks: string[]   // marques vues sur les mails récents (drapeaux, catégories) : sert à vérifier ce qu'OVH transmet
  folders: string[]
}

/** Test de connexion : ouvre la boîte, compte les mails récents et montre ce qu'OVH transmet (lu / non lu, drapeaux, catégories, dossiers). */
export async function testConnection(days = 3): Promise<ConnectionReport | { ok: false; error: string }> {
  const cfg = imapConfig()
  if (!cfg) return { ok: false, error: 'Variables MAIL_IMAP_HOST, MAIL_IMAP_USER ou MAIL_IMAP_PASSWORD absentes dans Vercel' }
  const client = newClient(cfg)
  try {
    await client.connect()
    const folders = (await client.list().catch(() => [])).map(f => f.path).slice(0, 40)
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const found = await client.search({ since: new Date(Date.now() - days * 86400000) }, { uid: true })
      const uids = (found || []).sort((a, b) => b - a).slice(0, 300)
      const info = await readFlags(client, uids)
      const marks = new Map<string, number>()
      let unread = 0; let todo = 0; let unanswered = 0
      for (const fi of info.values()) {
        const st = describeFlags(fi.flags)
        if (st.unread) unread++
        if (!st.answered) unanswered++
        if (st.target === 'A Faire' || st.target === 'En cours') todo++
        for (const x of fi.flags) if (x !== '\\Seen' && x !== '\\Recent') marks.set(x, (marks.get(x) ?? 0) + 1)
      }
      return { ok: true, count: uids.length, unread, unanswered, todo, marks: [...marks].map(([k, n]) => `${k} (${n})`), folders }
    } finally { lock.release() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erreur inconnue'
    return { ok: false, error: /auth|credential|login|password/i.test(msg) ? 'Identifiant ou mot de passe refusé par OVH' : msg }
  } finally { await client.logout().catch(() => { /* noop */ }) }
}
