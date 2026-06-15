import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/') ||
    pathname === '/favicon.ico'

  // Mode démo
  const isDemo = !!request.cookies.get('relays-demo')?.value
  if (isDemo) {
    if (pathname === '/login') return NextResponse.redirect(new URL('/kanban', request.url))
    return NextResponse.next()
  }

  // Vérifie si un cookie de session Supabase existe (sans appel réseau)
  const cookies = request.cookies.getAll()
  const hasSession = cookies.some(c => c.name.includes('-auth-token'))

  if (!hasSession && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (hasSession && pathname === '/login') {
    return NextResponse.redirect(new URL('/kanban', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
