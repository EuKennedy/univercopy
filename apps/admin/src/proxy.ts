import { NextResponse, type NextRequest } from 'next/server'

// Guard de borda — sem chamar DB. Apenas checa se há cookie de sessão e
// redireciona se não houver. Verificação real (sessão válida) acontece em
// layouts server-side via `auth.api.getSession({ headers: ... })`.
//
// Mantemos PUBLIC_PATHS minimalista: tudo que não está aqui é protegido.

const PUBLIC_PATHS = new Set([
  '/login',
  '/sign-up',
  '/invite',
  '/forgot-password',
  '/reset-password',
  '/magic-link',
  '/termos',
  '/privacidade',
  '/status',
  '/goodbye',
])

const PUBLIC_PREFIXES = [
  '/api/auth/',  // Better Auth lida com auth via /api/auth/*
  '/_next/',
  '/favicon',
  '/icons/',
]

const SESSION_COOKIE_NAMES = [
  '__Secure-better-auth.session_token',
  'better-auth.session_token',
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  const hasSession = SESSION_COOKIE_NAMES.some(name => req.cookies.has(name))
  if (!hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Casa tudo exceto assets internos. Lista de matchers reduz overhead vs
  // rodar middleware em static files.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'],
}
