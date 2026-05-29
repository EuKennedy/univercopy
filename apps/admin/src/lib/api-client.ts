import { headers } from 'next/headers'

import { auth } from './auth'

// Cliente server-only pra Rails API. Lê a sessão atual via Better Auth e
// envia o token no header Authorization.
//
// Resolve URL em ordem (server-runtime):
//   1) INTERNAL_API_URL   ← Docker network entre admin↔api (http://api:3000)
//   2) API_URL            ← URL pública (https://api.univercopy.com)
//   3) NEXT_PUBLIC_API_URL← fallback build-time
//   4) http://localhost:3001 ← dev local
//
// Preferimos INTERNAL pra evitar round-trip pelo Traefik + TLS handshake +
// rate-limit público. Admin server-side fala direto com api via service-name
// na rede do compose.
//
// `||` em vez de `??` porque containers podem chegar com string vazia.

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message)
    this.name = 'ApiError'
  }
}

function resolveApiUrl(): string {
  const raw =
    process.env.INTERNAL_API_URL ||
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  return raw.replace(/\/+$/, '')
}

async function getSessionToken(): Promise<string | null> {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })
  return (session as { session?: { token?: string } } | null)?.session?.token ?? null
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  const url = `${resolveApiUrl()}${path.startsWith('/') ? path : `/${path}`}`

  let token: string | null = null
  try {
    token = await getSessionToken()
  } catch (err) {
    console.error('[apiFetch] session lookup failed', { url, method, err: String(err) })
    throw new ApiError(401, 'session_lookup_failed')
  }
  if (!token) throw new ApiError(401, 'unauthenticated')

  let res: Response
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
      cache: 'no-store',
    })
  } catch (err) {
    // Breadcrumb explícito pro Coolify log — runtime ENV ou network broken.
    console.error('[apiFetch] fetch threw', {
      url, method,
      err: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      env: {
        INTERNAL_API_URL: process.env.INTERNAL_API_URL ? 'set' : 'missing',
        API_URL: process.env.API_URL ? 'set' : 'missing',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ? 'set' : 'missing',
      },
    })
    throw new ApiError(502, `network: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  const text = await res.text()
  const body = text ? safeParse(text) : null

  if (!res.ok) {
    console.error('[apiFetch] non-2xx', { url, method, status: res.status, body })
    throw new ApiError(res.status, `${method} ${path} → ${res.status}`, body)
  }
  return body as T
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text) } catch { return text }
}
