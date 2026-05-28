import type { Config } from 'drizzle-kit'

// Drizzle gerencia APENAS o schema `auth.*` (Better Auth). Todo o domínio
// (workspaces, copies, brand_dnas, etc) é mantido pelo Rails via AR migrations.
// Os dois lados conhecem o mesmo banco e o `auth` schema isolado evita colisão.

export default {
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['auth'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config
