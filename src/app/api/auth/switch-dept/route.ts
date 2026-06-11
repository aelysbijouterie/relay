import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
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
