'use client'

import { createAuthClient } from 'better-auth/react'
import { magicLinkClient, organizationClient } from 'better-auth/client/plugins'

// Cliente Better Auth para componentes React. Compartilha sessão do server
// via cookie HttpOnly (não dá pra ler via JS — Better Auth resolve via fetch).
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_ADMIN_URL,
  plugins: [magicLinkClient(), organizationClient()],
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
