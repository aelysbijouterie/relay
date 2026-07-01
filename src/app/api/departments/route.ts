import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Liste simple des services (pour les filtres).
export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('departments').select('id, name, color, slug').order('name')
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [], { headers: { 'Cache-Control': 'no-store' } })
}
