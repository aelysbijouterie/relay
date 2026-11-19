import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { RawMail } from './filter'

export function imapConfig() {
  const host = process.env.MAIL_IMAP_HOST
  const user = process.env.MAIL_IMAP_USER
  const pass = process.env.MAIL_IMAP_PASSWORD
  return host && user && pass ? { host, user, pass } : null
}

/** Mot cherché dans les catégories / marques du mail pour le considérer « à traiter » (modifiable : MAIL_TODO_MARK). */
export function todoMark(): string { return (process.env.MAIL_TODO_MARK || 'traiter').toLowerCase() }
const isTodoFlag = (f: string) => f.toLowerCase().includes(todoMark())

function headerMap(h: Map<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of h) out[k.toLowerCase()] = typeof v === 'string' ? v : Array.isArray(v) ? String(v[0] ?? '') : v == null ? '' : String(typeof v === 'object' && 'value' in (v as object) ? (v as { value: unknown }).value : v)
  return out
}

const newClient = (cfg: { host: string; user: string; pass: string }) =>
  new ImapFlow({ host: cfg.host, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })

/** Étape légère : l'état (lu, drapeau, catégories) de tous les mails récents, sans télécharger leur contenu. */
async function readFlags(client: ImapFlow, uids: number[]): Promise<Map<number, Set<string>>> {
  const flags = new Map<number, Set<string>>()
  if (uids.length === 0) return flags
  for await (const msg of client.fetch(uids, { uid: true, flags: true }, { uid: true })) flags.set(msg.uid, new Set(msg.flags ?? []))
  return flags
}

/**
 * Lit les mails de la boîte de réception reçus depuis `days` jours (lecture seule : rien n'est modifié, déplacé ni marqué comme lu).
 * Ne télécharge que les mails utiles : NON LUS, ou marqués « à traiter » (catégorie), même s'ils sont déjà lus.
 */
export async function fetchRecentMails(days = 3, max = 40): Promise<{ mails: RawMail[]; scanned: number; readIgnored: number }> {
  const cfg = imapConfig()
  if (!cfg) throw new Error('Connexion mail non configurée (MAIL_IMAP_HOST / USER / PASSWORD)')
  const client = newClient(cfg)
  const mails: RawMail[] = []
  let scanned = 0; let readIgnored = 0
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const found = await client.search({ since: new Date(Date.now() - days * 86400000) }, { uid: true })
      const all = (found || []).sort((a, b) => b - a).slice(0, 300)
      scanned = all.length
      const flags = await readFlags(client, all)
      const wanted = all.filter(uid => {
        const f = flags.get(uid) ?? new Set<string>()
        return !f.has('\\Seen') || [...f].some(isTodoFlag)
      })
      readIgnored = all.length - wanted.length
      const uids = wanted.slice(0, max)
      if (uids.length === 0) return { mails: [], scanned, readIgnored }
      for await (const msg of client.fetch(uids, { uid: true, internalDate: true, source: { maxLength: 60000 } }, { uid: true })) {
        if (!msg.source) continue
        try {
          const p = await simpleParser(msg.source)
          const from = p.from?.value?.[0]
          const f = flags.get(msg.uid) ?? new Set<string>()
          mails.push({
            messageId: (p.messageId ?? `uid-${cfg.user}-${msg.uid}-${new Date(msg.internalDate ?? Date.now()).getTime()}`).trim(),
            fromName: from?.name ?? '',
            fromEmail: (from?.address ?? '').toLowerCase(),
            subject: (p.subject ?? '(sans objet)').trim(),
            date: p.date ?? new Date(msg.internalDate ?? Date.now()),
            text: p.text || (typeof p.html === 'string' ? p.html : ''),
            headers: headerMap(p.headers as unknown as Map<string, unknown>),
            unread: !f.has('\\Seen'),
            todo: [...f].some(isTodoFlag),
          })
        } catch { /* mail illisible : ignoré */ }
      }
    } finally { lock.release() }
  } finally { await client.logout().catch(() => { /* noop */ }) }
  return { mails: mails.sort((a, b) => b.date.getTime() - a.date.getTime()), scanned, readIgnored }
}

export interface ConnectionReport {
  ok: true; count: number; unread: number; todo: number
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
      const flags = await readFlags(client, uids)
      const marks = new Map<string, number>()
      let unread = 0; let todo = 0
      for (const f of flags.values()) {
        if (!f.has('\\Seen')) unread++
        if ([...f].some(isTodoFlag)) todo++
        for (const x of f) if (x !== '\\Seen' && x !== '\\Recent') marks.set(x, (marks.get(x) ?? 0) + 1)
      }
      return { ok: true, count: uids.length, unread, todo, marks: [...marks].map(([k, n]) => `${k} (${n})`), folders }
    } finally { lock.release() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erreur inconnue'
    return { ok: false, error: /auth|credential|login|password/i.test(msg) ? 'Identifiant ou mot de passe refusé par OVH' : msg }
  } finally { await client.logout().catch(() => { /* noop */ }) }
}
