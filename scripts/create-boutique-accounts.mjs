// Crée UN compte de connexion par boutique (+ le responsable comme premier collaborateur).
// À lancer APRÈS la migration 024 :   node scripts/create-boutique-accounts.mjs
// Idempotent : une boutique qui a déjà son compte est ignorée.
// Les identifiants générés sont écrits dans un fichier HORS du dépôt (jamais committé).

import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

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

function password() {
  // 12 caractères lisibles, sans caractères ambigus
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(12)
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('') + '!'
}

async function createAuthUser(email, pwd, name) {
  const res = await fetch(`${URL_}/auth/v1/admin/users`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, password: pwd, email_confirm: true, user_metadata: { name } }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.msg ?? data.message ?? JSON.stringify(data))
  return data.id
}

const deptRes = await (await rest('departments?select=id&slug=eq.boutiques')).json()
if (!Array.isArray(deptRes) || !deptRes[0]) throw new Error('Service « Boutiques » introuvable : la migration 024 a-t-elle été exécutée ?')
const deptId = deptRes[0].id

const boutiques = await (await rest('boutiques?select=id,code,name,email,responsable&order=code')).json()
if (!Array.isArray(boutiques)) throw new Error('Table boutiques illisible : ' + JSON.stringify(boutiques))
const existing = await (await rest('profiles?select=boutique_id&is_boutique_account=eq.true')).json()
const done = new Set(existing.map(p => p.boutique_id))

const lines = ['code;boutique;email_de_connexion;mot_de_passe']
for (const b of boutiques) {
  if (done.has(b.id)) { console.log(`= ${b.name} : compte déjà créé`); continue }
  const pwd = password()
  try {
    const id = await createAuthUser(b.email, pwd, b.name)
    const profile = await rest('profiles', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id, name: b.name, email: b.email, department_id: deptId, role: 'collaborateur',
        is_active: true, boutique_id: b.id, is_boutique_account: true,
        notify_email_assigned: true, notify_email_status: true, notify_email_deadlines: true,
        notify_email_weekly: false, notify_email_mentions: true,
      }),
    })
    if (!profile.ok) throw new Error('profil : ' + (await profile.text()))

    // Le responsable (prénom connu) devient le premier collaborateur de la boutique.
    if (b.responsable) {
      const mid = await createAuthUser(`membre-${randomUUID().slice(0, 8)}@boutiques.aelys.invalid`, `${randomUUID()}${randomUUID()}`, b.responsable)
      const m = await rest('profiles', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          id: mid, name: b.responsable, email: `membre-${mid.slice(0, 8)}@boutiques.aelys.invalid`,
          department_id: deptId, role: 'collaborateur', is_active: false, boutique_id: b.id, is_boutique_account: false,
          notify_email_assigned: false, notify_email_status: false, notify_email_deadlines: false,
          notify_email_weekly: false, notify_email_mentions: false,
        }),
      })
      if (!m.ok) console.log(`  ! responsable ${b.responsable} non créé : ${await m.text()}`)
    }
    lines.push(`${b.code};${b.name};${b.email};${pwd}`)
    console.log(`+ ${b.name} : compte créé (${b.email})`)
  } catch (e) {
    console.log(`! ${b.name} : ${e.message}`)
  }
}

if (lines.length > 1) {
  const out = join(homedir(), 'Documents', 'relays-comptes-boutiques.csv')
  writeFileSync(out, '﻿' + lines.join('\r\n'), 'utf8')
  console.log(`\nIdentifiants écrits dans : ${out}\n(à transmettre aux boutiques puis à supprimer — ne jamais committer)`)
}
