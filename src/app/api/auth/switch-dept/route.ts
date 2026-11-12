import { NextRequest, NextResponse } from 'next/server'
import { readSessionUserId } from '@/lib/session-cookie'

export async function POST(request: NextRequest) {
  const authUserId = readSessionUserId()
  if (!authUserId) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const { deptId } = await request.json()
  const response = NextResponse.json({ ok: true })
  response.cookies.set('relays-active-dept', deptId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}
