// Logique pure de la liaison RELAYS ⇄ Tempo (testée dans src/__tests__/tempoLogic.test.ts).

/** Forme d'une opération telle que Tempo la publie (voir docs/INSTRUCTIONS-TEMPO.md). */
export interface TempoOperation {
  id: string
  nom: string
  date_debut: string | null // AAAA-MM-JJ
  date_fin: string | null
  mecanique: string | null
  cgv_magasin: string | null
  cgv_web: string | null
  relays_task_id: string | null
  echeances: { ebauche: string | null; declinaisons: string | null; envoi_impression: string | null; controle_reception: string | null }
  etat: { ebauche_validee: boolean; declinaisons_validees: boolean; mail_imprimeur_envoye: boolean; controle_reception_envoye: boolean }
}

/** Nom comparable : sans accents, sans majuscules, sans ponctuation. */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const DATE_SUFFIX = /\s*[-–—]\s*\d{1,2}\/\d{1,2}(\s*[-–—→]\s*\d{1,2}\/\d{1,2})?\s*$/

/** « SOLDES HIVER - 06/01 - 02/02 » → « SOLDES HIVER ». */
export function parseOperationName(title: string): string {
  return title.replace(DATE_SUFFIX, '').trim()
}

const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Titre au format des cartes : « SOLDES HIVER - 06/01 - 02/02 ». */
export function formatOperationTitle(name: string, start: string | null, end: string | null): string {
  const n = name.trim().toUpperCase()
  if (start && end) return `${n} - ${dm(start)} - ${dm(end)}`
  if (start) return `${n} - ${dm(start)}`
  return n
}

export type StepKey = 'ebauche' | 'declinaisons' | 'envoi_impression' | 'controle_reception'

/**
 * Échéance de la carte : l'étape EN COURS dans Tempo.
 * ébauche → (une ébauche validée) déclinaisons → (toutes validées) envoi en impression → (mail parti) contrôle réception.
 * `undefined` = ne rien changer (étape inconnue de Tempo, ou tout est terminé).
 */
export function nextStep(op: Pick<TempoOperation, 'echeances' | 'etat'>): { step: StepKey; date: string } | undefined {
  const { echeances: e, etat: s } = op
  const step: StepKey | null = !s.ebauche_validee ? 'ebauche'
    : !s.declinaisons_validees ? 'declinaisons'
    : !s.mail_imprimeur_envoye ? 'envoi_impression'
    : !s.controle_reception_envoye ? 'controle_reception'
    : null
  if (!step || !e[step]) return undefined
  return { step, date: (e[step] as string).slice(0, 10) }
}

/** Sous-tâches du modèle pilotées par Tempo (clé = titre normalisé). */
export const SUBTASK_RULES: Record<string, { deadline: StepKey; done: (op: Pick<TempoOperation, 'etat'>) => boolean }> = {
  [normalizeName('Réalisation des visuels')]: { deadline: 'declinaisons', done: op => op.etat.declinaisons_validees },
  [normalizeName('Envoi en impression')]: { deadline: 'envoi_impression', done: op => op.etat.mail_imprimeur_envoye },
  [normalizeName('Contrôle réception')]: { deadline: 'controle_reception', done: op => op.etat.controle_reception_envoye },
}

/** Texte des CGV pour RELAYS (un seul bloc si magasin et web sont identiques). */
export function buildCgvText(magasin: string | null, web: string | null): string {
  const m = (magasin ?? '').trim(); const w = (web ?? '').trim()
  if (!m && !w) return ''
  if (m && w && m === w) return m
  return [m && `CGV magasin : ${m}`, w && `CGV web : ${w}`].filter(Boolean).join('\n\n')
}

/** Complète les lignes vides « Mécanique de l'opération : » et « CGV : » de la description du modèle (jamais d'écrasement). */
export function fillDescription(desc: string | null, mecanique: string | null, cgv: string): string {
  const lines = (desc ?? '').split('\n')
  const out = lines.map((l, i) => {
    if (/^\s*Mécanique de l['’]opération\s*:\s*$/i.test(l) && mecanique?.trim()) return `Mécanique de l'opération : ${mecanique.trim()}`
    // « CGV : » seul sur sa ligne et rien derrière : à compléter (s'il y a déjà du texte en dessous, on n'y touche pas).
    if (/^\s*CGV\s*:\s*$/i.test(l) && cgv && !(lines[i + 1] ?? '').trim()) return `CGV :\n${cgv}`
    return l
  })
  return out.join('\n')
}

const fmtFr = (iso: string | null) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—'

/** Texte de dissonance (null = les deux plateformes sont d'accord, ou une date manque d'un côté). */
export function dateConflict(relays: { debut: string | null; fin: string | null }, tempo: { debut: string | null; fin: string | null }): string | null {
  const d = (a: string | null, b: string | null) => !!a && !!b && a.slice(0, 10) !== b.slice(0, 10)
  if (!d(relays.debut, tempo.debut) && !d(relays.fin, tempo.fin)) return null
  return `RELAYS : ${fmtFr(relays.debut)} → ${fmtFr(relays.fin)} · Tempo : ${fmtFr(tempo.debut)} → ${fmtFr(tempo.fin)}`
}

const ms = (iso: string) => Date.parse(iso.slice(0, 10) + 'T00:00:00Z')

/**
 * Même édition d'une opération ? Oui si les périodes se chevauchent, ou si les dates de début sont à moins de 60 jours.
 * Deux opérations de même nom mais d'années différentes sont DEUX opérations distinctes.
 * Dates inconnues d'un côté : on ne peut pas conclure, on considère que c'est la même édition.
 */
export function sameEdition(a: { debut: string | null; fin: string | null }, b: { debut: string | null; fin: string | null }): boolean {
  const as = a.debut ?? a.fin; const bs = b.debut ?? b.fin
  if (!as || !bs) return true
  const ae = a.fin ?? as; const be = b.fin ?? bs
  if (ms(as) <= ms(be) && ms(bs) <= ms(ae)) return true
  return Math.abs(ms(as) - ms(bs)) < 60 * 86400000
}
