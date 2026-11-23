// Crée les cartes « Opération commerciale » 2027 (planning annuel) à partir du modèle « OPÉRATION COMMERCIALE - [DATE] ».
// Usage :  node scripts/create-operations-2027.mjs --dry-run   (affiche, sans rien écrire)
//          node scripts/create-operations-2027.mjs             (crée les cartes)
// Idempotent : une carte dont le titre existe déjà (non supprimée) est ignorée.
// Chaque carte : catégorie Opération commerciale, titre « NOM - JJ/MM - JJ/MM », mécanique renseignée,
// description et liste à cocher du modèle, créée par et assignée à Manon (service Marketing).

import { readFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry-run')
const OWNER_EMAIL = 'manon.mignot@aelys.fr'
const TEMPLATE = 'OPÉRATION COMMERCIALE - [DATE]'

// [nom, début, fin, mécanique]
const OPS = [
  ['VENTES PRIVÉES HIVER', '2026-12-28', '2027-01-05', 'Pastillage sur tout'],
  ['SOLDES HIVER', '2027-01-06', '2027-02-02', 'Pastillage sur tout'],
  ['SAINT-VALENTIN', '2027-02-03', '2027-02-14', '-20 % sur une sélection vitrine'],
  ['OP PRIVILÈGE', '2027-03-01', '2027-03-28', '-50 % sur le 2ᵉ, sur tout'],
  ['LES BEAUX JOURS', '2027-04-01', '2027-04-27', 'Pastillage sur tout'],
  ['FRENCH DAYS DE PRINTEMPS', '2027-04-29', '2027-05-05', null],
  ['FÊTE DES MÈRES', '2027-05-04', '2027-05-30', '-20 % sur une sélection vitrine'],
  ['FÊTE DES PÈRES', '2027-05-31', '2027-06-15', '-20 % sur une sélection vitrine'],
  ['VENTES PRIVÉES ÉTÉ', '2027-06-16', '2027-06-22', 'Pastillage sur tout'],
  ['SOLDES ÉTÉ', '2027-06-23', '2027-07-20', 'Pastillage sur tout'],
  ['PETITS PRIX ÉTÉ', '2027-08-02', '2027-08-29', '-20 % sur un rayon tournant'],
  ['LES JOURS EN OR', '2027-09-01', '2027-09-21', 'Pastillage sur tout'],
  ['FRENCH DAYS D’AUTOMNE', '2027-09-22', '2027-09-28', '-20 % sur tout'],
  ['L’ANNIVERSAIRE AÉLYS', '2027-10-04', '2027-11-01', '-50 % sur le 2ᵉ, sur tout'],
  ['NOËL EN AVANT-PREMIÈRE', '2027-11-02', '2027-11-21', 'Pastillage sur tout'],
  ['BLACK FRIDAY', '2027-11-22', '2027-11-29', '-50 % sur tout'],
  ['NOËL', '2027-12-01', '2027-12-24', '-50 % sur le 2ᵉ, private label'],
]

const dm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_ || !KEY) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local')
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const rest = (path, init = {}) => fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } })
const json = async r => { if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json() }

const [tpl] = await json(await rest(`task_templates?select=*&name=eq.${encodeURIComponent(TEMPLATE)}`))
if (!tpl) throw new Error(`Modèle « ${TEMPLATE} » introuvable`)
const [owner] = await json(await rest(`profiles?select=id,department_id&email=eq.${encodeURIComponent(OWNER_EMAIL)}`))
if (!owner) throw new Error('Profil introuvable')
const subtasks = Array.isArray(tpl.default_subtasks) ? tpl.default_subtasks : []

let created = 0, skipped = 0
for (const [name, start, end, mecanique] of OPS) {
  const title = `${name} - ${dm(start)} - ${dm(end)}`
  const exists = await json(await rest(`tasks?select=id&deleted_at=is.null&title=eq.${encodeURIComponent(title)}&op_category=eq.operation_commerciale`))
  if (exists.length) { console.log(`= déjà là   ${title}`); skipped++; continue }
  console.log(`${DRY ? '? à créer  ' : '+ créée    '} ${title}   [${start} → ${end}]  ${mecanique}  (${subtasks.length} sous-tâches)`)
  if (DRY) continue
  const [task] = await json(await rest('tasks', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      title, description: tpl.default_description ?? null, status: 'A Faire', priority: tpl.default_priority ?? 'Moyenne',
      department_id: owner.department_id, created_by: owner.id, is_cross_team: false,
      op_category: 'operation_commerciale', op_date_debut: start, op_date_fin: end, op_mecanique: mecanique,
    }),
  }))
  await json(await rest('task_assignees', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ task_id: task.id, user_id: owner.id }) }))
  if (subtasks.length) {
    await json(await rest('task_subtasks', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify(subtasks.map((s, i) => ({ task_id: task.id, title: s.title, group_name: s.group ?? 'Général', position: i, is_done: false, created_by: owner.id }))),
    }))
  }
  created++
}
console.log(DRY ? `\nSimulation : ${OPS.length - skipped} carte(s) seraient créées, ${skipped} déjà présente(s).` : `\n${created} carte(s) créée(s), ${skipped} déjà présente(s).`)
