// Kanban : les cartes « opération commerciale » qui démarrent dans plus de 3 mois sont masquées
// (elles réapparaissent toutes seules à l'approche de leur début).

/** Date limite : aujourd'hui + 3 mois, au format AAAA-MM-JJ (jour local). */
export function farOperationCutoff(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
  // 31 nov → 1er déc : on revient au dernier jour du mois visé
  if (d.getMonth() !== (now.getMonth() + 3) % 12) d.setDate(0)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Vrai si la carte est une opération commerciale dont le début est dans plus de 3 mois. */
export function isFarOperation(t: { op_category?: string | null; op_date_debut?: string | null }, now: Date = new Date()): boolean {
  if (t.op_category !== 'operation_commerciale' || !t.op_date_debut) return false
  return t.op_date_debut.slice(0, 10) > farOperationCutoff(now)
}
