// Script à lancer UNE SEULE FOIS pour créer tous les comptes Supabase
// Usage : node scripts/create-users.mjs
//
// Remplace SUPABASE_URL et SERVICE_ROLE_KEY avec tes vraies valeurs
// (Settings → API dans le dashboard Supabase)

const SUPABASE_URL      = 'https://XXXX.supabase.co'   // ← remplace
const SERVICE_ROLE_KEY  = 'eyJhbGci...'                // ← remplace (service_role)
const DEFAULT_PASSWORD  = 'Aelys2024!'

const USERS = [
  { email: 'manon.mignot@aelys.fr',       name: 'Manon Mignot' },
  { email: 'marketing.aelys@aelys.fr',    name: 'Charline Ballarin' },
  { email: 'wendy.vignes@aelys.fr',       name: 'Wendy Vignes' },
  { email: 'web@aelys.fr',               name: 'Maylis Andrieu' },
  { email: 'audrey.arees@aelys.fr',       name: 'Audrey Arees' },
  { email: 'bureau-occitania@aelys.fr',   name: 'Sarah Turon' },
  { email: 'chloe.estangoy@aelys.fr',     name: 'Chloé Estangoy' },
  { email: 'ludwig.barrachin@aelys.fr',   name: 'Ludwig Barrachin' },
  { email: 'office-cabi@aelys.fr',        name: 'Nassima Chayek' },
  { email: 'stock-occitania@aelys.fr',    name: 'Sophie Guilcher' },
  { email: 'direction@aelys.fr',          name: 'Direction' },
  { email: 'maylis.andrieu@aelys.fr',     name: 'Maylis Andrieu' },
]

async function createUser(email, name) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password:      DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    if (data.message?.includes('already been registered') || data.code === 'email_exists') {
      console.log(`⚠️  ${email} — existe déjà, ignoré`)
    } else {
      console.error(`❌ ${email} — erreur :`, data.message ?? JSON.stringify(data))
    }
    return
  }

  console.log(`✅ ${email} — créé (${name})`)
}

console.log('Création des comptes Supabase...\n')
for (const { email, name } of USERS) {
  await createUser(email, name)
  await new Promise(r => setTimeout(r, 300)) // petite pause entre chaque requête
}
console.log('\nTerminé ! Mot de passe temporaire :', DEFAULT_PASSWORD)
