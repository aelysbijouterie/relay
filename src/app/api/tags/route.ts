import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// Liste de tous les tags disponibles (prédéfinis + créés par les utilisateurs).
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('tags')
    .select('id, name, color')
    .order('name', { ascending: true })

  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}

// Créer un nouveau tag à la volée.
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await request.json()
  const name = (body.name ?? '').trim()
  const color = (body.color ?? '#6366f1').trim()
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const supabase = createAdminClient()
  // upsert sur le nom unique : si le tag existe déjà, on le renvoie au lieu d'échouer.
  const { data, error } = await supabase
    .from('tags')
    .upsert({ name, color, created_by: userId }, { onConflict: 'name' })
    .select('id, name, color')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}