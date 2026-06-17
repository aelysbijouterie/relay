import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role, department_id, department:departments(id, name, color, slug)')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.error('Profiles error:', error.message)
    return NextResponse.json([])
  }
  return NextResponse.json(data ?? [])
}
