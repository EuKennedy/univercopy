import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin, magicLink, organization, bearer } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'

import { db } from './db'
import { account, invitation, member, organization as org, session, user, verification } from './db/schema/auth'

// ---------------------------------------------------------------------
// Better Auth — fonte única de autenticação do admin.
//
// Por que `cookieCache: { enabled: false }`?
//   Bug conhecido em rotação de secret + sessão deletada server-side:
//   browser permanece "autenticado" até a próxima visita full. Aceitamos
//   1 query DB/request (~1-2ms) para garantir consistência.
//
// Por que `requireEmailVerification: false`?
//   UX: usuário pode fazer login antes mesmo de confirmar email. Verificação
//   é prompt no painel; bloquear login em dia 1 mata conversion sem trocar
//   por segurança real (email já está checado via magic-link na origem).
// ---------------------------------------------------------------------

const baseURL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000'
const apiURL  = process.env.NEXT_PUBLIC_API_URL   ?? 'http://localhost:3001'
const cookieDomain = process.env.COOKIE_DOMAIN
const trustedOrigins = [baseURL, apiURL, ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',') ?? [])]
  .map(s => s.trim()).filter(Boolean)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification, organization: org, member, invitation },
  }),

  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,

  session: {
    expiresIn: 60 * 60 * 24 * 7,    // 7 dias
    updateAge: 60 * 60 * 24,         // renova após 1 dia
    cookieCache: { enabled: false }, // intencional — ver header acima
  },

  advanced: {
    crossSubDomainCookies: cookieDomain ? { enabled: true, domain: cookieDomain } : { enabled: false },
    defaultCookieAttributes: { sameSite: 'lax', secure: true, httpOnly: true },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 8,
    autoSignIn: true,
    password: {
      async hash(password) {
        const bcrypt = await import('bcryptjs')
        return bcrypt.hash(password, 12)
      },
      async verify({ password, hash }) {
        const bcrypt = await import('bcryptjs')
        return bcrypt.compare(password, hash)
      },
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async () => {
      // Implementado na Fase 3.B (templates Resend).
      return Promise.resolve()
    },
  },

  plugins: [
    magicLink({
      expiresIn: 60 * 15, // 15 min
      disableSignUp: false,
      sendMagicLink: async () => {
        // Implementado na Fase 3.B (templates Resend).
        return Promise.resolve()
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 10,
      membershipLimit: 100,
      sendInvitationEmail: async () => Promise.resolve(),
    }),
    admin({ defaultRole: 'user' }),
    bearer(),
    nextCookies(), // SEMPRE por último — wraps cookie ops para Next.
  ],
})

export type Session = typeof auth.$Infer.Session
