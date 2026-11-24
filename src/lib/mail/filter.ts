// Logique pure (testée) : quels mails méritent d'être envoyés à l'IA, et comment nettoyer leur texte.

export interface RawMail {
  messageId: string
  fromName: string
  fromEmail: string
  subject: string
  date: Date
  text: string
  headers: Record<string, string>
  to?: string[]      // adresses des destinataires directs (À)
  cc?: string[]      // adresses en copie (Cc)
  unread?: boolean   // non lu dans la boîte
  answered?: boolean // une réponse a été envoyée
  todo?: boolean     // marqué « à traiter » / « en cours » (catégorie ou drapeau Outlook)
  target?: CardStatus | null // colonne visée d'après la marque
}

export type CardStatus = 'A Faire' | 'En cours' | 'Terminé'

/**
 * Colonne du Kanban visée d'après les marques du mail (catégories Outlook = « mots-clés » IMAP, ou drapeau de suivi) :
 * « terminé / clos / fini » → Terminé ; « en cours » → En cours ; drapeau ou « à traiter » → À faire ; sinon aucune marque.
 */
export function targetStatus(flagged: boolean, marks: string[]): CardStatus | null {
  const l = marks.map(x => x.toLowerCase())
  if (l.some(x => /(termin|clos|fini)/.test(x))) return 'Terminé'
  if (l.some(x => x.includes('cours'))) return 'En cours'
  if (flagged || l.some(x => x.includes('traiter'))) return 'A Faire'
  return null
}

const AUTO_SENDER = /(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|notifications?@|newsletter|bounce|alerts?@)/i
const AUTO_SUBJECT = /^(accept[ée]|refus[ée]|provisoire|r[ée]ponse automatique|automatic reply|out of office|absence du bureau|undeliverable|delivery status)/i

// Mails envoyés par l'application Tempo (suivi des visuels) : jamais de carte automatique.
const TEMPO_SUBJECT = /^\s*((re|tr|fwd?)\s*:\s*)*(\[tempo\]|test\s*\d+\s*[—–-]|contr[ôo]le r[ée]ception valid[ée])/i
export function isTempoMail(m: Pick<RawMail, 'fromName' | 'fromEmail' | 'subject' | 'text'>): boolean {
  return TEMPO_SUBJECT.test(m.subject) || /\btempo\b/i.test(m.fromName) || /\btempo@/i.test(m.fromEmail) || /pac-aelys\.vercel\.app/i.test(m.text)
}

// Mails de La Réserve (commandes de produits consommables) : jamais de carte, quoi qu'il arrive.
export function isReserveMail(m: Pick<RawMail, 'fromName' | 'fromEmail' | 'subject'>): boolean {
  return /la r[ée]serve/i.test(m.fromName) || /^\s*((re|tr|fwd?)\s*:\s*)*\[cmd-\d+/i.test(m.subject)
}

/** Rôle de la propriétaire dans le mail : destinataire directe (À), seulement en copie (Cc), ou autre (liste, alias, copie cachée). */
export function recipientRole(m: Pick<RawMail, 'to' | 'cc'>, own: string): 'to' | 'cc' | 'other' {
  const o = own.trim().toLowerCase()
  if (!o) return 'other'
  if ((m.to ?? []).includes(o)) return 'to'
  if ((m.cc ?? []).includes(o)) return 'cc'
  return 'other'
}

/** Raison pour laquelle un mail est écarté AVANT l'IA, ou null s'il doit être analysé. */
export function skipReason(m: RawMail, ownAddress: string, exclude: string[]): string | null {
  // Mails automatiques de Tempo et de La Réserve : écartés dans TOUS les cas, même marqués « à traiter ».
  if (isTempoMail(m)) return 'mail de Tempo'
  if (isReserveMail(m)) return 'mail de La Réserve (commandes de consommables)'
  // Un mail marqué « à traiter » n'est écarté que par la liste d'exclusion (confidentialité), jamais par les filtres de bruit.
  if (m.todo) {
    const hayT = `${m.fromName} ${m.fromEmail} ${m.subject} ${m.text}`.toLowerCase()
    for (const w of exclude) if (w && hayT.includes(w)) return `exclu (« ${w} »)`
    return null
  }
  const from = m.fromEmail.toLowerCase()
  // En copie seulement (pas dans « À ») : le mail ne demande rien à la propriétaire.
  if (recipientRole(m, ownAddress) === 'cc') return 'en copie seulement'
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
