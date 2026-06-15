import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(request: NextRequest) {
  const raw = request.cookies.get('relays-session')?.value
  if (!raw) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const supabase = createAdmin()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role, department_id, department:departments(id, name, color, slug)')
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
