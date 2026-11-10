// Crée les accès « siège » supplémentaires (Direction et Direction Régionale).
// Usage :  node scripts/create-hq-accounts.mjs --dry-run     (affiche ce qui serait créé, sans rien écrire)
//          node scripts/create-hq-accounts.mjs --password=...  (crée les comptes)
// Idempotent : une adresse qui a déjà un profil est ignorée.
// Mot de passe temporaire : donné au lancement avec --password=... (rappelé dans un fichier HORS du dépôt, jamais committé) ;
// chaque personne doit ensuite en choisir un nouveau (« Mot de passe oublié » ou page Compte).
// Ces profils sont de vrais profils du siège (aucune boutique) : mêmes droits et mêmes accès que les autres
// collaborateurs du siège ; on peut les identifier sur les cartes et sous-tâches.

import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DRY = process.argv.includes('--dry-run')

const ACCOUNTS = [
  // Pôle Direction
  { email: 'jf.imbert@aelys.fr',               name: 'JF Imbert',    dept: 'direction' },
  { email: 'jerome.negre@aelys.fr',            name: 'Jérôme Nègre', dept: 'direction' },
  // Pôle Direction Régionale (avec Audrey Voyat)
  { email: 'resp.420@cge-bijouteries.fr',      name: 'Marie LE ROUX',   dept: 'direction-regionale' },
  { email: 'resp.422@cge-bijouteries.fr',      name: 'Elodie GROS',     dept: 'direction-regionale' },
  { email: 'resp.423@cge-bijouteries.fr',      name: 'Caroline THOMAS', dept: 'direction-regionale' },
]

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

// Mot de passe temporaire commun, donné au lancement (le dépôt est PUBLIC : il ne doit jamais y être écrit) :
//   node scripts/create-hq-accounts.mjs --password=MotDePasse
// Supabase refuse un mot de passe trop court ou trop faible (« 0000 » est refusé ; le format « Aelys200 » passe).
const TEMP_PASSWORD = process.argv.find(a => a.startsWith('--password='))?.slice('--password='.length) ?? ''
if (!DRY && TEMP_PASSWORD.length < 6) throw new Error('Mot de passe manquant ou trop court : lancez avec --password=...')
function password() { return TEMP_PASSWORD }

const depts = await (await rest('departments?select=id,slug,name')).json()
if (!Array.isArray(depts)) throw new Error('Services illisibles : ' + JSON.stringify(depts))
const deptBySlug = new Map(depts.map(d => [d.slug, d]))
for (const slug of new Set(ACCOUNTS.map(a => a.dept))) {
  if (!deptBySlug.has(slug)) throw new Error(`Service « ${slug} » introuvable. Services connus : ${depts.map(d => d.slug).join(', ')}`)
}

const lines = ['email_de_connexion;nom;service;mot_de_passe_temporaire']
for (const a of ACCOUNTS) {
  const dept = deptBySlug.get(a.dept)
  const found = await (await rest(`profiles?select=id&email=ilike.${encodeURIComponent(a.email)}`)).json()
  if (Array.isArray(found) && found.length > 0) { console.log(`= ${a.email} : profil déjà existant, ignoré`); continue }
  if (DRY) { console.log(`+ (simulation) ${a.email} → ${a.name}, service « ${dept.name} »`); continue }

  const pwd = password()
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST', headers,
    body: JSON.stringify({ email: a.email, password: pwd, email_confirm: true, user_metadata: { name: a.name } }),
  })
  const data = await res.json()
  if (!res.ok) { console.log(`! ${a.email} : ${data.msg ?? data.message ?? JSON.stringify(data)}`); continue }

  const profile = await rest('profiles', {
    method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: data.id, name: a.name, email: a.email, department_id: dept.id, role: 'collaborateur', is_active: true,
      notify_email_assigned: true, notify_email_status: true, notify_email_deadlines: true,
      notify_email_weekly: false, notify_email_mentions: true,
    }),
  })
  if (!profile.ok) { console.log(`! ${a.email} : compte créé mais profil non créé : ${await profile.text()}`); continue }
  lines.push(`${a.email};${a.name};${dept.name};${pwd}`)
  console.log(`+ ${a.email} : créé (${a.name}, ${dept.name})`)
}

if (lines.length > 1) {
  const out = join(homedir(), 'Documents', 'relays-comptes-siege.csv')
  writeFileSync(out, '﻿' + lines.join('\r\n'), 'utf8')
  console.log(`\nIdentifiants temporaires écrits dans : ${out}\n(à transmettre puis à supprimer — ne jamais committer ; chacun peut changer son mot de passe via « Mot de passe oublié »)`)
} else if (DRY) {
  console.log('\nSimulation terminée : rien n\'a été créé.')
}
