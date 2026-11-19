import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import type { RawMail } from './filter'

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

/** Lit les mails de la boîte de réception reçus depuis `days` jours (lecture seule, rien n'est modifié ni supprimé). */
export async function fetchRecentMails(days = 3, max = 60): Promise<RawMail[]> {
  const cfg = imapConfig()
  if (!cfg) throw new Error('Connexion mail non configurée (MAIL_IMAP_HOST / USER / PASSWORD)')
  const client = new ImapFlow({ host: cfg.host, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })
  const mails: RawMail[] = []
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const since = new Date(Date.now() - days * 86400000)
      const found = await client.search({ since }, { uid: true })
      const uids = (found || []).sort((a, b) => b - a).slice(0, max)
      if (uids.length === 0) return []
      for await (const msg of client.fetch(uids, { uid: true, internalDate: true, source: { maxLength: 200000 } }, { uid: true })) {
        if (!msg.source) continue
        try {
          const p = await simpleParser(msg.source)
          const from = p.from?.value?.[0]
          mails.push({
            messageId: (p.messageId ?? `uid-${cfg.user}-${msg.uid}-${new Date(msg.internalDate ?? Date.now()).getTime()}`).trim(),
            fromName: from?.name ?? '',
            fromEmail: (from?.address ?? '').toLowerCase(),
            subject: (p.subject ?? '(sans objet)').trim(),
            date: p.date ?? new Date(msg.internalDate ?? Date.now()),
            text: p.text || (typeof p.html === 'string' ? p.html : ''),
            headers: headerMap(p.headers as unknown as Map<string, unknown>),
          })
        } catch { /* mail illisible : ignoré */ }
      }
    } finally { lock.release() }
  } finally { await client.logout().catch(() => { /* noop */ }) }
  return mails.sort((a, b) => b.date.getTime() - a.date.getTime())
}

/** Test de connexion : ouvre la boîte et compte les mails des derniers jours, sans rien analyser. */
export async function testConnection(days = 3): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const cfg = imapConfig()
  if (!cfg) return { ok: false, error: 'Variables MAIL_IMAP_HOST, MAIL_IMAP_USER ou MAIL_IMAP_PASSWORD absentes dans Vercel' }
  const client = new ImapFlow({ host: cfg.host, port: 993, secure: true, auth: { user: cfg.user, pass: cfg.pass }, logger: false })
  try {
    await client.connect()
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const found = await client.search({ since: new Date(Date.now() - days * 86400000) }, { uid: true })
      return { ok: true, count: (found || []).length }
    } finally { lock.release() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erreur inconnue'
    return { ok: false, error: /auth|credential|login|password/i.test(msg) ? 'Identifiant ou mot de passe refusé par OVH' : msg }
  } finally { await client.logout().catch(() => { /* noop */ }) }
}
