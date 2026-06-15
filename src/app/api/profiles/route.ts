import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const supabase = createAdmin()

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
