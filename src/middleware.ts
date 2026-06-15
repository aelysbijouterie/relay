import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Toujours accessible
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Mode démo — laisser passer
  const isDemo = !!request.cookies.get('relays-demo')?.value
  if (isDemo) return NextResponse.next()

  // Session Supabase — vérifie si un cookie auth existe
  const hasSession = request.cookies.getAll().some(c => c.name.includes('-auth-token'))
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
