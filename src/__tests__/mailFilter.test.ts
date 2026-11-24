import { describe, expect, it } from 'vitest'
import { cleanBody, parseExclude, skipReason, targetStatus, type RawMail } from '@/lib/mail/filter'
import { sanitizeAnalyses } from '@/lib/mail/analyze'

const base: RawMail = { messageId: '<1@x>', fromName: 'Marie Durand', fromEmail: 'marie@client.fr', subject: 'Devis à envoyer', date: new Date(), text: 'Pouvez-vous m’envoyer le devis ?', headers: {} }

describe('skipReason', () => {
  it('garde un mail normal', () => expect(skipReason(base, 'moi@aelys.fr', [])).toBeNull())
  it('écarte mes propres mails', () => expect(skipReason({ ...base, fromEmail: 'MOI@aelys.fr' }, 'moi@aelys.fr', [])).not.toBeNull())
  it('écarte les expéditeurs automatiques', () => expect(skipReason({ ...base, fromEmail: 'noreply@shop.com' }, 'moi@aelys.fr', [])).not.toBeNull())
  it('écarte les newsletters', () => expect(skipReason({ ...base, headers: { 'list-unsubscribe': '<mailto:x>' } }, 'moi@aelys.fr', [])).not.toBeNull())
  it('écarte les réponses automatiques', () => expect(skipReason({ ...base, subject: 'Réponse automatique : absente' }, 'moi@aelys.fr', [])).not.toBeNull())
  it('un mail marqué « à traiter » passe les filtres de bruit', () => expect(skipReason({ ...base, fromEmail: 'noreply@shop.com', todo: true }, 'moi@aelys.fr', [])).toBeNull())
  it('mais reste soumis à la liste d’exclusion', () => expect(skipReason({ ...base, todo: true, text: 'bulletin de paie' }, 'moi@aelys.fr', ['paie'])).not.toBeNull())
  it('respecte la liste d’exclusion (mot dans le corps)', () => expect(skipReason({ ...base, text: 'Votre bulletin de paie' }, 'moi@aelys.fr', parseExclude('Paie, salaire'))).not.toBeNull())
})

describe('cleanBody', () => {
  it('retire les balises et coupe les réponses citées', () => {
    const t = cleanBody('<p>Bonjour</p><p>Merci d’envoyer le devis</p><p>Cordialement</p><p>Marie</p>\nLe lundi 3 mars, Jean a écrit :\n> ancien message')
    expect(t).toContain('Merci d’envoyer le devis')
    expect(t).not.toContain('ancien message')
  })
  it('limite la longueur', () => expect(cleanBody('a'.repeat(5000), 100).length).toBeLessThanOrEqual(101))
})

describe('sanitizeAnalyses', () => {
  it('nettoie priorité, échéance et indices invalides', () => {
    const out = sanitizeAnalyses([
      { i: 0, actions: [{ title: ' Envoyer le devis ', description: 'x', priority: 'Urgent', deadline: '2026-12-01' }, { title: '', description: '', priority: 'Urgent' }] },
      { i: 9, actions: [{ title: 'hors lot', description: '', priority: 'Faible' }] },
      { i: 1, actions: [{ title: 'Appeler', description: '', priority: 'Bizarre', deadline: 'demain' }] },
    ], 2)
    expect(out).toHaveLength(2)
    expect(out[0].actions).toEqual([{ title: 'Envoyer le devis', description: 'x', priority: 'Urgent', deadline: '2026-12-01' }])
    expect(out[1].actions[0]).toMatchObject({ priority: 'Moyenne', deadline: null })
  })
  it('renvoie une liste vide si la réponse n’est pas un tableau', () => expect(sanitizeAnalyses({ a: 1 }, 3)).toEqual([]))
})

describe('targetStatus', () => {
  it('aucune marque', () => expect(targetStatus(false, [])).toBeNull())
  it('drapeau = À faire', () => expect(targetStatus(true, [])).toBe('A Faire'))
  it('catégorie « À traiter » = À faire', () => expect(targetStatus(false, ['A_traiter', 'Autre'])).toBe('A Faire'))
  it('catégorie « En cours » = En cours (prioritaire sur le drapeau)', () => expect(targetStatus(true, ['En_cours'])).toBe('En cours'))
  it('catégorie « Terminé » = Terminé', () => expect(targetStatus(true, ['Terminé'])).toBe('Terminé'))
})

import { isTempoMail } from '@/lib/mail/filter'
describe('mails de Tempo', () => {
  const base = { fromName: 'La Réserve', fromEmail: 'x@exemple.fr', text: 'Bonjour' }
  it('reconnaît les mails Tempo (sujet, nom, lien)', () => {
    expect(isTempoMail({ ...base, subject: '[Tempo] Livraison aujourd’hui — Un Noël enchanté' })).toBe(true)
    expect(isTempoMail({ ...base, subject: 'RE: [Tempo] Échéance dans 2 jours — SOLDES' })).toBe(true)
    expect(isTempoMail({ ...base, subject: 'TEST 3 — SOLDES — impression' })).toBe(true)
    expect(isTempoMail({ ...base, subject: 'CONTROLE RECEPTION VALIDÉ - SOLDES - 12/01/2027' })).toBe(true)
    expect(isTempoMail({ ...base, subject: 'Visuels', text: 'Voir https://pac-aelys.vercel.app/operations/12' })).toBe(true)
  })
  it('laisse passer les autres mails', () => {
    expect(isTempoMail({ ...base, subject: 'Erreur horaires Google', text: 'Merci de corriger' })).toBe(false)
    expect(isTempoMail({ ...base, subject: 'Calendrier de l’Avent Aélys 2026' })).toBe(false)
  })
})

import { isReserveMail, recipientRole } from '@/lib/mail/filter'
const mk = (o: Partial<RawMail>): RawMail => ({ messageId: 'm', fromName: 'Jean', fromEmail: 'jean@client.fr', subject: 'Question', date: new Date(), text: 'Bonjour', headers: {}, ...o })
const ME = 'manon.mignot@aelys.fr'
describe('La Réserve, copie et destinataires', () => {
  it('reconnaît les mails de La Réserve', () => {
    expect(isReserveMail(mk({ fromName: 'La Réserve', subject: 'Nouvelle commande' }))).toBe(true)
    expect(isReserveMail(mk({ subject: '[CMD-0010] Nouvelle commande — Aélys Nemours' }))).toBe(true)
    expect(isReserveMail(mk({ subject: 'RE: [CMD-0011-MKT] Nouvelle demande' }))).toBe(true)
    expect(isReserveMail(mk({ subject: 'Erreur horaires Google' }))).toBe(false)
  })
  it('Tempo et La Réserve sont écartés même marqués « à traiter »', () => {
    expect(skipReason(mk({ subject: '[Tempo] Livraison aujourd’hui', todo: true }), ME, [])).toBe('mail de Tempo')
    expect(skipReason(mk({ subject: '[CMD-0010] Nouvelle commande', todo: true }), ME, [])).toContain('La Réserve')
  })
  it('rôle du destinataire : À, Cc ou autre', () => {
    expect(recipientRole({ to: [ME], cc: [] }, ME)).toBe('to')
    expect(recipientRole({ to: ['a@x.fr'], cc: [ME] }, ME)).toBe('cc')
    expect(recipientRole({ to: ['liste@aelys.fr'], cc: [] }, ME)).toBe('other')
    expect(recipientRole({ to: [], cc: [] }, '')).toBe('other')
  })
  it('en copie seulement = écarté ; dans « À » ou liste = analysé', () => {
    expect(skipReason(mk({ to: ['a@x.fr'], cc: [ME] }), ME, [])).toBe('en copie seulement')
    expect(skipReason(mk({ to: [ME], cc: ['a@x.fr'] }), ME, [])).toBeNull()
    expect(skipReason(mk({ to: ['liste@aelys.fr'], cc: [] }), ME, [])).toBeNull()
  })
})
