// Importe les collaborateurs des boutiques (et leur reste de congés à poser) depuis un fichier JSON
// produit à partir du classeur « Compteur jours ».
// Usage : node scripts/import-boutique-members.mjs <fichier.json> [--dry-run]
// À lancer APRÈS la migration 026. Idempotent : un collaborateur déjà présent est mis à jour, pas dupliqué.
//  - le responsable déjà créé avec son seul prénom est complété (« Audrey » → « Audrey HOF »)
//  - reste à poser = colonne « Congés restant » ; leave_balance_since = aujourd'hui (les congés
//    validés dans RELAYS à partir d'aujourd'hui sont déduits de ce reste)

import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const file = process.argv[2]
const dry = process.argv.includes('--dry-run')
if (!file) throw new Error('Usage : node scripts/import-boutique-members.mjs <fichier.json> [--dry-run]')

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const rest = (path, init = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })

const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const titleCase = s => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p, c) => p + c.toUpperCase())
const people = JSON.parse(readFileSync(file, 'utf8'))
const today = new Date().toISOString().slice(0, 10)

// Les colonnes de la migration 026 doivent exister
const probe = await rest('profiles?select=contract_type,leave_balance_since&limit=1')
if (!probe.ok) throw new Error('Colonnes contract_type / leave_balance_since absentes : exécute d\'abord la migration 026 dans Supabase.')

const boutiques = await (await rest('boutiques?select=id,code,name')).json()
const byCode = new Map(boutiques.map(b => [b.code, b]))
const deptRows = await (await rest('departments?select=id&slug=eq.boutiques')).json()
const deptId = deptRows[0]?.id
if (!deptId) throw new Error('Service « Boutiques » introuvable (migration 024).')

const existingAll = await (await rest('profiles?select=id,name,boutique_id&boutique_id=not.is.null&is_boutique_account=eq.false')).json()

let created = 0, updated = 0, failed = 0
for (const p of people) {
  const b = byCode.get(p.code)
  if (!b) { console.log(`! boutique ${p.code} inconnue — ${p.prenom} ${p.nom} ignoré`); failed++; continue }
  const displayName = `${titleCase(p.prenom)} ${p.nom.toUpperCase()}`
  const mine = existingAll.filter(e => e.boutique_id === b.id)
  const full = norm(`${p.prenom} ${p.nom}`)
  const first = norm(p.prenom)
  // 1) même nom complet ; 2) responsable créé avec son seul prénom
  const match = mine.find(e => norm(e.name) === full) ?? mine.find(e => norm(e.name) === first)

  const fields = {
    name: displayName,
    contract_type: p.contrat,
    leave_balance_conges: p.restant,
    leave_balance_since: today,
  }

  if (match) {
    if (dry) { console.log(`~ ${b.name} : ${match.name} → ${displayName} (reste ${p.restant})`); updated++; continue }
    const r = await rest(`profiles?id=eq.${match.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(fields) })
    if (!r.ok) { console.log(`! ${displayName} : ${await r.text()}`); failed++; continue }
    console.log(`~ ${b.name} : ${displayName} mis à jour (reste ${p.restant})`); updated++
    continue
  }

  if (dry) { console.log(`+ ${b.name} : ${displayName} (reste ${p.restant})`); created++; continue }
  const email = `membre-${randomUUID().slice(0, 8)}@boutiques.aelys.invalid`
  const auth = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, password: `${randomUUID()}${randomUUID()}`, email_confirm: true, user_metadata: { name: displayName } }),
  })
  const authData = await auth.json()
  if (!auth.ok) { console.log(`! ${displayName} : ${authData.msg ?? authData.message}`); failed++; continue }
  const prof = await rest('profiles', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: authData.id, email, department_id: deptId, role: 'collaborateur', is_active: false,
      boutique_id: b.id, is_boutique_account: false,
      notify_email_assigned: false, notify_email_status: false, notify_email_deadlines: false,
      notify_email_weekly: false, notify_email_mentions: false,
      ...fields,
    }),
  })
  if (!prof.ok) { console.log(`! ${displayName} : profil ${await prof.text()}`); failed++; continue }
  console.log(`+ ${b.name} : ${displayName} créé (reste ${p.restant})`); created++
}

// Collaborateurs déjà présents mais absents du classeur (ex : responsable saisi par prénom seul)
const importedBoutiques = new Set(people.map(p => p.code))
console.log(`\n${dry ? '[simulation] ' : ''}${created} créé(s), ${updated} mis à jour, ${failed} en échec`)
for (const b of boutiques.filter(b => importedBoutiques.has(b.code))) {
  const names = new Set(people.filter(p => p.code === b.code).flatMap(p => [norm(`${p.prenom} ${p.nom}`), norm(p.prenom)]))
  for (const e of existingAll.filter(e => e.boutique_id === b.id && !names.has(norm(e.name)))) {
    console.log(`? ${b.name} : « ${e.name} » n'est pas dans le classeur (conservé tel quel)`)
  }
}
