import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { accruedMonths, MONTHLY_ACCRUAL } from '@/lib/absences/leaveRules'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

async function requireHr(supabase: ReturnType<typeof createAdminClient>): Promise<boolean> {
  const userId = getUserId()
  if (!userId) return false
  const { data } = await supabase.from('profiles').select('can_validate_boutiques').eq('id', userId).single()
  return data?.can_validate_boutiques === true
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const CONTRACTS = ['CDI', 'CDD', 'Apprentissage', 'CDD+6', 'Apprentissage+1']
const clean = (s: unknown) => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '')
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase())

// POST : la RH crée un collaborateur de boutique (nouvel entrant) et l'attribue à un magasin.
// Les jours « en cours d'acquisition » sont calculés automatiquement depuis la date d'entrée
// (2,08 j par mois écoulé de la période en cours, mois d'entrée compté) ; le cron mensuel prend ensuite le relais.
export async function POST(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await requireHr(supabase))) return NextResponse.json({ error: 'Accès réservé à la RH' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  const first = titleCase(clean(b.first_name)), last = clean(b.last_name).toUpperCase()
  if (first.length < 2 || last.length < 2 || first.length + last.length > 70) return NextResponse.json({ error: 'Prénom et nom requis' }, { status: 400 })
  if (!DATE.test(b.hire_date ?? '')) return NextResponse.json({ error: "Date d'entrée requise" }, { status: 400 })
  const contract = CONTRACTS.includes(b.contract_type) ? b.contract_type : 'CDI'
  const name = `${first} ${last}`

  const { data: shop } = await supabase.from('boutiques').select('id, name').eq('id', b.boutique_id ?? '').single()
  if (!shop) return NextResponse.json({ error: 'Boutique inconnue' }, { status: 400 })
  const { data: dept } = await supabase.from('departments').select('id').eq('slug', 'boutiques').single()
  if (!dept) return NextResponse.json({ error: 'Service Boutiques introuvable' }, { status: 500 })

  const { data: dup } = await supabase.from('profiles').select('id').eq('boutique_id', shop.id).ilike('name', name)
  if ((dup ?? []).length > 0) return NextResponse.json({ error: 'Ce collaborateur existe déjà dans cette boutique' }, { status: 409 })

  const today = new Date().toISOString().slice(0, 10)
  const acquiring = Math.round(accruedMonths(b.hire_date, today) * MONTHLY_ACCRUAL * 100) / 100
  const initial = b.leave_balance_conges === undefined || b.leave_balance_conges === '' ? 0 : Number(b.leave_balance_conges)

  const email = `membre-${crypto.randomUUID().slice(0, 8)}@boutiques.aelys.invalid`
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email, password: `${crypto.randomUUID()}${crypto.randomUUID()}`, email_confirm: true, user_metadata: { name },
  })
  if (authErr || !created.user) return NextResponse.json({ error: authErr?.message ?? 'Création impossible' }, { status: 500 })

  const { error: profErr } = await supabase.from('profiles').insert({
    id: created.user.id, name, email, department_id: dept.id, role: 'collaborateur', is_active: false,
    boutique_id: shop.id, is_boutique_account: false, contract_type: contract, hire_date: b.hire_date,
    is_cadre: b.is_cadre === true, leave_balance_conges: Number.isFinite(initial) ? initial : 0, leave_balance_since: today,
    leave_acquiring: acquiring, leave_taken_period: 0,
    notify_email_assigned: false, notify_email_status: false, notify_email_deadlines: false, notify_email_weekly: false, notify_email_mentions: false,
  })
  if (profErr) {
    await supabase.auth.admin.deleteUser(created.user.id)
    return NextResponse.json({ error: profErr.message }, { status: 500 })
  }
  return NextResponse.json({ success: true, id: created.user.id, name, boutique: shop.name, acquiring })
}

// PATCH { id, boutique_id?, hire_date?, contract_type?, is_cadre? } : l'attribution et la fiche d'un collaborateur.
export async function PATCH(request: NextRequest) {
  const supabase = createAdminClient()
  if (!(await requireHr(supabase))) return NextResponse.json({ error: 'Accès réservé à la RH' }, { status: 403 })

  const b = await request.json().catch(() => ({}))
  if (typeof b.id !== 'string') return NextResponse.json({ error: 'Collaborateur requis' }, { status: 400 })
  const { data: target } = await supabase.from('profiles').select('id, boutique_id, is_boutique_account').eq('id', b.id).single()
  if (!target?.boutique_id || target.is_boutique_account) return NextResponse.json({ error: 'Collaborateur inconnu' }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (typeof b.boutique_id === 'string' && b.boutique_id) {
    const { data: shop } = await supabase.from('boutiques').select('id').eq('id', b.boutique_id).single()
    if (!shop) return NextResponse.json({ error: 'Boutique inconnue' }, { status: 400 })
    updates.boutique_id = shop.id
  }
  if (b.hire_date === null || (typeof b.hire_date === 'string' && DATE.test(b.hire_date))) updates.hire_date = b.hire_date
  if (typeof b.contract_type === 'string') updates.contract_type = b.contract_type.trim().slice(0, 40) || null
  if (typeof b.is_cadre === 'boolean') updates.is_cadre = b.is_cadre
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Rien à modifier' }, { status: 400 })

  const { error } = await supabase.from('profiles').update(updates).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
