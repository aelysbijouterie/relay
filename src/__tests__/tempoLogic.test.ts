import { describe, it, expect } from 'vitest'
import { buildCgvText, dateConflict, fillDescription, formatOperationTitle, nextStep, normalizeName, parseOperationName, SUBTASK_RULES } from '@/lib/tempo/logic'

const ech = { ebauche: '2026-10-02', declinaisons: '2026-10-09', envoi_impression: '2026-10-12', controle_reception: '2026-10-26' }
const etat = (o: Partial<{ ebauche_validee: boolean; declinaisons_validees: boolean; mail_imprimeur_envoye: boolean; controle_reception_envoye: boolean }> = {}) =>
  ({ ebauche_validee: false, declinaisons_validees: false, mail_imprimeur_envoye: false, controle_reception_envoye: false, ...o })

describe('titres', () => {
  it('formate et relit le nom', () => {
    const t = formatOperationTitle('Soldes hiver', '2027-01-06', '2027-02-02')
    expect(t).toBe('SOLDES HIVER - 06/01 - 02/02')
    expect(parseOperationName(t)).toBe('SOLDES HIVER')
    expect(parseOperationName('NOËL - 01/12 - 24/12')).toBe('NOËL')
    expect(parseOperationName('Noël en avant-première')).toBe('Noël en avant-première')
  })
  it('compare les noms sans accents ni apostrophes', () => {
    expect(normalizeName('L’ANNIVERSAIRE AÉLYS')).toBe(normalizeName("L'Anniversaire Aélys"))
  })
})

describe('échéance de la carte = étape en cours', () => {
  it('suit la chaîne ébauche → déclinaisons → impression → réception', () => {
    expect(nextStep({ echeances: ech, etat: etat() })).toEqual({ step: 'ebauche', date: '2026-10-02' })
    expect(nextStep({ echeances: ech, etat: etat({ ebauche_validee: true }) })).toEqual({ step: 'declinaisons', date: '2026-10-09' })
    expect(nextStep({ echeances: ech, etat: etat({ ebauche_validee: true, declinaisons_validees: true }) })).toEqual({ step: 'envoi_impression', date: '2026-10-12' })
    expect(nextStep({ echeances: ech, etat: etat({ ebauche_validee: true, declinaisons_validees: true, mail_imprimeur_envoye: true }) })).toEqual({ step: 'controle_reception', date: '2026-10-26' })
  })
  it('ne change rien quand tout est terminé ou que la date est inconnue', () => {
    expect(nextStep({ echeances: ech, etat: etat({ ebauche_validee: true, declinaisons_validees: true, mail_imprimeur_envoye: true, controle_reception_envoye: true }) })).toBeUndefined()
    expect(nextStep({ echeances: { ...ech, ebauche: null }, etat: etat() })).toBeUndefined()
  })
})

describe('sous-tâches pilotées par Tempo', () => {
  it('coche selon l’état Tempo', () => {
    const r = SUBTASK_RULES[normalizeName('Réalisation des visuels')]
    expect(r.done({ etat: etat({ declinaisons_validees: true }) })).toBe(true)
    expect(r.done({ etat: etat() })).toBe(false)
    expect(SUBTASK_RULES[normalizeName('Envoi en impression')].done({ etat: etat({ mail_imprimeur_envoye: true }) })).toBe(true)
    expect(SUBTASK_RULES[normalizeName('Contrôle réception')].done({ etat: etat({ controle_reception_envoye: true }) })).toBe(true)
  })
})

describe('CGV et description', () => {
  it('un seul bloc si magasin = web', () => { expect(buildCgvText(' A ', 'A')).toBe('A') })
  it('deux blocs sinon', () => { expect(buildCgvText('A', 'B')).toBe('CGV magasin : A\n\nCGV web : B') })
  it('complète les lignes vides sans rien écraser', () => {
    const d = "Mécanique de l'opération :\nCGV :"
    const f = fillDescription(d, 'Pastillage sur tout', 'Texte CGV')
    expect(f).toBe("Mécanique de l'opération : Pastillage sur tout\nCGV :\nTexte CGV")
    expect(fillDescription(f, 'Autre', 'Autre CGV')).toBe(f)
  })
})

describe('dissonance de dates', () => {
  it('aucune si identiques ou si une date manque', () => {
    expect(dateConflict({ debut: '2027-01-06', fin: '2027-02-02' }, { debut: '2027-01-06', fin: '2027-02-02' })).toBeNull()
    expect(dateConflict({ debut: null, fin: null }, { debut: '2027-01-06', fin: '2027-02-02' })).toBeNull()
  })
  it('détecte une différence', () => {
    expect(dateConflict({ debut: '2027-11-02', fin: '2027-11-21' }, { debut: '2027-11-04', fin: '2027-11-21' })).toContain('02/11/2027')
  })
})
