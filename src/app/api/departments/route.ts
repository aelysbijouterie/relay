import { NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Liste simple des services (pour les filtres).
export async function GET() {
  const authUserId = readSessionUserId()
  if (!authUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('departments').select('id, name, color, slug').order('name')
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}
