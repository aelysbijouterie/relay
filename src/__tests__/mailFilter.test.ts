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
