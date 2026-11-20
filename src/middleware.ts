import { NextResponse, type NextRequest } from 'next/server'
import { isValidSessionValue } from '@/lib/session-edge'
import { HOME_COOKIE, sanitizeHome } from '@/lib/home-view'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/RELAYS-raccourci.bat' ||
    pathname.startsWith('/icons/')
  ) return NextResponse.next()

  const isDemo    = !!request.cookies.get('relays-demo')?.value
  // Cookie de session SIGNÉ : un cookie falsifié ou ancien (non signé) ne compte pas comme connecté.
  const isSession = await isValidSessionValue(request.cookies.get('relays-session')?.value)
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
  if (isAuth && isLogin && !isReset) return NextResponse.redirect(new URL(sanitizeHome(request.cookies.get(HOME_COOKIE)?.value), request.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|RELAYS-raccourci.bat|icons/).*)'],
}
