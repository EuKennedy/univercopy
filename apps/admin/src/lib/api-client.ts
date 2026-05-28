import { headers } from 'next/headers'

import { auth } from './auth'

// Cliente server-only pra Rails API. Lê a sessão atual via Better Auth e
// envia o token no header Authorization (cross-origin compatível: admin
// e api podem ficar em hosts diferentes durante dev).
//
// NUNCA importar em código client. Server Actions ou Route Handlers só.

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message)
    this.name = 'ApiError'
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getSessionToken(): Promise<string | null> {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })
  return (session as { session?: { token?: string } } | null)?.session?.token ?? null
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getSessionToken()
  if (!token) throw new ApiError(401, 'unauthenticated')

  const url = `${API_URL}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
    cache: 'no-store',
  })

  const text = await res.text()
  const body = text ? safeParse(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} → ${res.status}`, body)
  }
  return body as T
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text) } catch { return text }
}
