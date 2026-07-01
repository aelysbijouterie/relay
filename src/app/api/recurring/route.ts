import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function getUserId(): string | null {
  try { return JSON.parse(cookies().get('relays-session')?.value ?? '').user_id ?? null } catch { return null }
}

// GET : tous les modèles récurrents.
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('recurring_tasks')
    .select('*, department:departments!department_id(id, name, color)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  const mapped = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r, department: Array.isArray(r.department) ? r.department[0] : r.department,
  }))
  return NextResponse.json(mapped, { headers: { 'Cache-Control': 'no-store' } })
}

// POST : créer un modèle récurrent.
export async function POST(request: NextRequest) {
  const userId = getUserId()
  if (!userId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const b = await request.json()
  if (!b.title || !b.frequency) return NextResponse.json({ error: 'Titre et fréquence requis' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('recurring_tasks').insert({
    title: b.title.trim(),
    description: b.description?.trim() || null,
    priority: b.priority || 'Moyenne',
    department_id: b.department_id || null,
    created_by: userId,
    frequency: b.frequency,
    weekday: b.frequency === 'weekly' ? b.weekday : null,
    month_day: b.frequency === 'monthly_day' ? b.month_day : null,
    assignee_ids: Array.isArray(b.assignee_ids) ? b.assignee_ids : [],
    is_active: true,
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id })
}
