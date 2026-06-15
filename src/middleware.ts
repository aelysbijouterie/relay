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

  if (!isAuth && !isLogin) return NextResponse.redirect(new URL('/login', request.url))
  if (isAuth && isLogin)   return NextResponse.redirect(new URL('/kanban', request.url))

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
