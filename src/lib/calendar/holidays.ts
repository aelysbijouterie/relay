// Jours fériés français et vacances scolaires ZONE B.
// ⚠️ Codés en dur — à mettre à jour chaque année (voir en bas de fichier).

// ── Jours fériés (France métropolitaine) 2025 & 2026 ────────────────────────
export const PUBLIC_HOLIDAYS: Record<string, string> = {
  // 2025
  '2025-01-01': 'Jour de l\'An',
  '2025-04-21': 'Lundi de Pâques',
  '2025-05-01': 'Fête du Travail',
  '2025-05-08': 'Victoire 1945',
  '2025-05-29': 'Ascension',
  '2025-06-09': 'Lundi de Pentecôte',
  '2025-07-14': 'Fête nationale',
  '2025-08-15': 'Assomption',
  '2025-11-01': 'Toussaint',
  '2025-11-11': 'Armistice 1918',
  '2025-12-25': 'Noël',
  // 2026
  '2026-01-01': 'Jour de l\'An',
  '2026-04-06': 'Lundi de Pâques',
  '2026-05-01': 'Fête du Travail',
  '2026-05-08': 'Victoire 1945',
  '2026-05-14': 'Ascension',
  '2026-05-25': 'Lundi de Pentecôte',
  '2026-07-14': 'Fête nationale',
  '2026-08-15': 'Assomption',
  '2026-11-01': 'Toussaint',
  '2026-11-11': 'Armistice 1918',
  '2026-12-25': 'Noël',
  // 2027
  '2027-01-01': 'Jour de l\'An',
  '2027-03-29': 'Lundi de Pâques',
  '2027-05-01': 'Fête du Travail',
  '2027-05-06': 'Ascension',
  '2027-05-08': 'Victoire 1945',
  '2027-05-17': 'Lundi de Pentecôte',
  '2027-07-14': 'Fête nationale',
  '2027-08-15': 'Assomption',
  '2027-11-01': 'Toussaint',
  '2027-11-11': 'Armistice 1918',
  '2027-12-25': 'Noël',
}

// ── Vacances scolaires ZONE B — année scolaire 2025-2026 ────────────────────
// Périodes [début, fin] incluses (dates de congé, hors reprise).
export const SCHOOL_HOLIDAYS_ZONE_B: { label: string; start: string; end: string }[] = [
  { label: 'Vacances de la Toussaint',  start: '2025-10-18', end: '2025-11-02' },
  { label: 'Vacances de Noël',          start: '2025-12-20', end: '2026-01-04' },
  { label: 'Vacances d\'hiver',         start: '2026-02-14', end: '2026-03-01' },
  { label: 'Vacances de printemps',     start: '2026-04-11', end: '2026-04-26' },
  { label: 'Vacances d\'été',           start: '2026-07-04', end: '2026-08-31' },
  // Année scolaire 2026-2027 (zone B, arrêté du 22 octobre 2025)
  { label: 'Vacances de la Toussaint',  start: '2026-10-17', end: '2026-11-01' },
  { label: 'Vacances de Noël',          start: '2026-12-19', end: '2027-01-03' },
  { label: 'Vacances d\'hiver',         start: '2027-02-20', end: '2027-03-07' },
  { label: 'Vacances de printemps',     start: '2027-04-17', end: '2027-05-02' },
  { label: 'Vacances d\'été',           start: '2027-07-03', end: '2027-08-31' },
]

// ── Vacances scolaires des trois zones (A, B, C) ────────────────────────────
// Calendrier officiel (éducation.gouv.fr) : périodes [début, fin] incluses, du samedi au dimanche précédant la reprise.
// ⚠️ À RECOUPER chaque année avec la publication officielle.
export type SchoolZone = 'A' | 'B' | 'C'
export const SCHOOL_ZONES: SchoolZone[] = ['A', 'B', 'C']
export const ZONE_COLORS: Record<SchoolZone, string> = { A: '#3B82F6', B: '#F59E0B', C: '#10B981' }
const ALL: SchoolZone[] = ['A', 'B', 'C']
export const SCHOOL_HOLIDAYS: { label: string; start: string; end: string; zones: SchoolZone[] }[] = [
  { label: 'Vacances de la Toussaint', start: '2025-10-18', end: '2025-11-02', zones: ALL },
  { label: 'Vacances de Noël',         start: '2025-12-20', end: '2026-01-04', zones: ALL },
  { label: 'Vacances d’hiver',        start: '2026-02-07', end: '2026-02-22', zones: ['A'] },
  { label: 'Vacances d’hiver',        start: '2026-02-14', end: '2026-03-01', zones: ['B'] },
  { label: 'Vacances d’hiver',        start: '2026-02-21', end: '2026-03-08', zones: ['C'] },
  { label: 'Vacances de printemps',    start: '2026-04-04', end: '2026-04-19', zones: ['A'] },
  { label: 'Vacances de printemps',    start: '2026-04-11', end: '2026-04-26', zones: ['B'] },
  { label: 'Vacances de printemps',    start: '2026-04-18', end: '2026-05-03', zones: ['C'] },
  { label: 'Vacances d’été',          start: '2026-07-04', end: '2026-08-31', zones: ALL },
  { label: 'Vacances de la Toussaint', start: '2026-10-17', end: '2026-11-01', zones: ALL },
  { label: 'Vacances de Noël',         start: '2026-12-19', end: '2027-01-03', zones: ALL },
  { label: 'Vacances d’hiver',        start: '2027-02-06', end: '2027-02-21', zones: ['A'] },
  { label: 'Vacances d’hiver',        start: '2027-02-13', end: '2027-02-28', zones: ['C'] },
  { label: 'Vacances d’hiver',        start: '2027-02-20', end: '2027-03-07', zones: ['B'] },
  { label: 'Vacances de printemps',    start: '2027-04-10', end: '2027-04-25', zones: ['A'] },
  { label: 'Vacances de printemps',    start: '2027-04-17', end: '2027-05-02', zones: ['B'] },
  { label: 'Vacances de printemps',    start: '2027-04-24', end: '2027-05-09', zones: ['C'] },
  { label: 'Vacances d’été',          start: '2027-07-03', end: '2027-08-31', zones: ALL },
]

/** Zones en vacances à une date donnée (limitées aux zones demandées). */
export function schoolZonesOn(dateStr: string, only: SchoolZone[] = SCHOOL_ZONES): SchoolZone[] {
  const out = new Set<SchoolZone>()
  for (const v of SCHOOL_HOLIDAYS) {
    if (dateStr >= v.start && dateStr <= v.end) v.zones.forEach(z => { if (only.includes(z)) out.add(z) })
  }
  return SCHOOL_ZONES.filter(z => out.has(z))
}

/** Libellé d'infobulle : « Vacances d'hiver — zones A, B ». */
export function schoolZonesLabel(dateStr: string, only: SchoolZone[] = SCHOOL_ZONES): string | null {
  const parts: string[] = []
  for (const v of SCHOOL_HOLIDAYS) {
    if (dateStr < v.start || dateStr > v.end) continue
    const zs = v.zones.filter(z => only.includes(z))
    if (zs.length) parts.push(`${v.label} — ${zs.length === 3 ? 'toutes zones' : `zone${zs.length > 1 ? 's' : ''} ${zs.join(', ')}`}`)
  }
  return parts.length ? parts.join(' · ') : null
}

export function holidayName(dateStr: string): string | null {
  return PUBLIC_HOLIDAYS[dateStr] ?? null
}

export function schoolHolidayName(dateStr: string): string | null {
  const p = SCHOOL_HOLIDAYS_ZONE_B.find(v => dateStr >= v.start && dateStr <= v.end)
  return p ? p.label : null
}

// ⚠️ MISE À JOUR ANNUELLE :
// Chaque été, remplacer/compléter ces tableaux avec les dates de la nouvelle
// année scolaire (jours fériés + vacances zone B publiés sur education.gouv.fr).
