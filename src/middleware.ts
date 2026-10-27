import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) return NextResponse.next()

  const isDemo    = !!request.cookies.get('relays-demo')?.value
  const isSession = !!request.cookies.get('relays-session')?.value
  const isAuth    = isDemo || isSession
  const isLogin   = pathname.startsWith('/login') || pathname.startsWith('/auth')
                    || pathname.startsWith('/mot-de-passe-oublie')
                    || pathname.startsWith('/reinitialiser-mot-de-passe')

  if (!isAuth && !isLogin) return NextResponse.redirect(new URL('/login', request.url))

  // Compte de boutique : seules 3 vues sont accessibles (Kanban, PAC & Média Kit, Congés).
  const isBoutique = !!request.cookies.get('relays-boutique')?.value
  const boutiqueAllowed = ['/kanban', '/pac-media-kit', '/conges']
  if (isBoutique && isSession && !isLogin && !boutiqueAllowed.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/kanban', request.url))
  }
  // Pages publiques de réinitialisation : accessibles même connecté (lien e-mail).
  const isReset = pathname.startsWith('/mot-de-passe-oublie') || pathname.startsWith('/reinitialiser-mot-de-passe')
  if (isAuth && isLogin && !isReset) return NextResponse.redirect(new URL('/kanban', request.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
