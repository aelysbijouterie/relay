// Nettoie les doublons de cartes créées depuis les mails : garde la plus ancienne de chaque sujet, met les autres à la corbeille (récupérables).
// Usage : node scripts/dedupe-mail-cards.mjs          → simulation (ne modifie rien)
//         node scripts/dedupe-mail-cards.mjs --apply  → met les doublons à la corbeille
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' }
const U = env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/'
const apply = process.argv.includes('--apply')
const norm = s => { let t = s.trim(); for (let i = 0; i < 6; i++) { const n = t.replace(/^\s*(re|tr|fw|fwd|rép|ré|réf)\s*:\s*/i, ''); if (n === t) break; t = n } return t.replace(/\s+/g, ' ').trim().toLowerCase() }

const r = await fetch(U + 'tasks?select=id,title,status,created_at,created_by,description,completed_at&deleted_at=is.null&description=ilike.*Origine%20:%20mail*&order=created_at.asc&limit=2000', { headers: H })
const tasks = await r.json()
if (!Array.isArray(tasks)) { console.error(tasks); process.exit(1) }

// Regroupe par sujet de mail (clé 1) ; les cartes de même titre exact sont aussi regroupées (clé 2).
const parent = new Map(tasks.map(t => [t.id, t.id]))
const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
const union = (a, b) => parent.set(find(a), find(b))
const seen = new Map()
for (const t of tasks) {
  const m = /« ([\s\S]*?) »(?: \(\d{4}-\d{2}-\d{2}\))?\s*$/.exec(t.description || '')
  for (const k of [m && 's:' + t.created_by + ':' + norm(m[1]), 't:' + t.created_by + ':' + t.title.trim().toLowerCase()].filter(Boolean)) {
    if (seen.has(k)) union(t.id, seen.get(k)); else seen.set(k, t.id)
  }
}
const groups = {}
for (const t of tasks) (groups[find(t.id)] ??= []).push(t)
let toDelete = []
for (const g of Object.values(groups)) {
  if (g.length < 2) continue
  // On garde la carte la plus avancée (terminée / en cours) sinon la plus ancienne.
  const rank = { 'Terminé': 3, 'En cours': 2, 'A revoir': 1 }
  g.sort((a, b) => (rank[b.status] ?? 0) - (rank[a.status] ?? 0) || a.created_at.localeCompare(b.created_at))
  console.log(`${g.length}x  garde « ${g[0].title.slice(0, 60)} » (${g[0].status}) → ${g.length - 1} à la corbeille`)
  toDelete.push(...g.slice(1))
}
console.log(`\n${toDelete.length} cartes en trop sur ${tasks.length}.`)
if (!apply) { console.log('Simulation : rien n’a été modifié. Relancer avec --apply pour les mettre à la corbeille.'); process.exit(0) }
for (let i = 0; i < toDelete.length; i += 50) {
  const ids = toDelete.slice(i, i + 50).map(t => t.id).join(',')
  const res = await fetch(U + `tasks?id=in.(${ids})`, { method: 'PATCH', headers: H, body: JSON.stringify({ deleted_at: new Date().toISOString() }) })
  if (!res.ok) { console.error('Erreur', res.status, await res.text()); process.exit(1) }
}
console.log('Fait : les doublons sont dans la Corbeille de RELAYS (restaurables).')
