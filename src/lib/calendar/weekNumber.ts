// Numéro de semaine ISO 8601 (semaine du lundi au dimanche ; la semaine 1 est celle qui contient le 4 janvier).

export function isoWeekNumber(date: Date): number {
  // On travaille en UTC sur la date locale, pour ne pas être gêné par l'heure d'été.
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7 // lundi = 1 … dimanche = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum) // le jeudi de la même semaine décide de l'année
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7)
}
