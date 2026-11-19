// Logique pure (testée) : quels mails méritent d'être envoyés à l'IA, et comment nettoyer leur texte.

export interface RawMail {
  messageId: string
  fromName: string
  fromEmail: string
  subject: string
  date: Date
  text: string
  headers: Record<string, string>
}

const AUTO_SENDER = /(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|notifications?@|newsletter|bounce|alerts?@)/i
const AUTO_SUBJECT = /^(accept[ée]|refus[ée]|provisoire|r[ée]ponse automatique|automatic reply|out of office|absence du bureau|undeliverable|delivery status)/i

/** Raison pour laquelle un mail est écarté AVANT l'IA, ou null s'il doit être analysé. */
export function skipReason(m: RawMail, ownAddress: string, exclude: string[]): string | null {
  const from = m.fromEmail.toLowerCase()
  if (ownAddress && from === ownAddress.toLowerCase()) return 'envoyé par moi'
  if (AUTO_SENDER.test(from)) return 'expéditeur automatique'
  if (AUTO_SUBJECT.test(m.subject.trim())) return 'réponse automatique ou accusé'
  const h = m.headers
  if (h['list-unsubscribe'] || h['list-id']) return 'newsletter / liste de diffusion'
  const auto = (h['auto-submitted'] ?? '').toLowerCase()
  if (auto && auto !== 'no') return 'message automatique'
  if (/(bulk|list|junk)/i.test(h['precedence'] ?? '')) return 'envoi en masse'
  const hay = `${m.fromName} ${from} ${m.subject} ${m.text}`.toLowerCase()
  for (const w of exclude) if (w && hay.includes(w)) return `exclu (« ${w} »)`
  return null
}

export function parseExclude(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
}

/** Texte brut utile : balises retirées, réponses citées coupées, longueur limitée. */
export function cleanBody(textOrHtml: string, max = 3000): string {
  let t = textOrHtml
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  const lines = t.split(/\r?\n/)
  const cut = lines.findIndex(l => /^(le .{5,80} a écrit\s*:|on .{5,80} wrote:|de\s*:|from\s*:|-{3,}\s*(message d'origine|original message))/i.test(l.trim()))
  if (cut > 3) t = lines.slice(0, cut).join('\n')
  t = t.split(/\r?\n/).filter(l => !l.trim().startsWith('>')).join('\n')
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}
