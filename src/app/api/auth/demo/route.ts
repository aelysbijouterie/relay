import { NextResponse, type NextRequest } from 'next/server'
import { DEMO_DEPARTMENTS } from '@/lib/demo-data'

export async function POST(request: NextRequest) {
  const { slug } = await request.json().catch(() => ({ slug: 'marketing' }))
  const dept = DEMO_DEPARTMENTS.find(d => d.slug === slug) ?? DEMO_DEPARTMENTS[0]

  const response = NextResponse.json({ success: true })
  response.cookies.set('relays-demo', dept.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('relays-demo')
  return response
}
