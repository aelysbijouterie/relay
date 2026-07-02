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
}

// ── Vacances scolaires ZONE B — année scolaire 2025-2026 ────────────────────
// Périodes [début, fin] incluses (dates de congé, hors reprise).
export const SCHOOL_HOLIDAYS_ZONE_B: { label: string; start: string; end: string }[] = [
  { label: 'Vacances de la Toussaint',  start: '2025-10-18', end: '2025-11-02' },
  { label: 'Vacances de Noël',          start: '2025-12-20', end: '2026-01-04' },
  { label: 'Vacances d\'hiver',         start: '2026-02-14', end: '2026-03-01' },
  { label: 'Vacances de printemps',     start: '2026-04-11', end: '2026-04-26' },
  { label: 'Vacances d\'été',           start: '2026-07-04', end: '2026-08-31' },
]

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
