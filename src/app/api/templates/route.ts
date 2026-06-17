import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Liste des modèles disponibles (tous partagés — créables par tout le monde).
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_templates')
    .select('id, name, default_title, default_description, default_priority, default_deadline_days, default_subtasks, department_id')
    .order('name', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

// Créer un modèle (depuis le formulaire ou depuis une carte existante).
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Nom du modèle requis' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('task_templates')
    .insert({
      name,
      default_title:        body.default_title ?? null,
      default_description:  body.default_description ?? null,
      default_priority:     body.default_priority ?? 'Moyenne',
      default_deadline_days: typeof body.default_deadline_days === 'number' ? body.default_deadline_days : null,
      default_subtasks:     Array.isArray(body.default_subtasks) ? body.default_subtasks : [],
      department_id:        body.department_id ?? null,
      created_by:           userId,
      is_shared:            true,
    })
    .select('id, name')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}