import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './db/schema'

// Cliente Postgres compartilhado. Pool por process: 5 conexões — Next admin
// é low-write/low-read (auth + queries de UI). API Rails é onde mora o
// throughput de domínio.
//
// IMPORTANTE: `prepare: false` em modo Transaction-Mode pooler (PgBouncer/
// Coolify). Em conexão direta dá pra ligar — Better Auth não usa prepared
// statements internamente, então o impacto é nulo.

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL env required for admin app — drizzle/Better Auth need it.')
}

const queryClient = postgres(connectionString, {
  max: 5,
  prepare: false,
})

export const db = drizzle(queryClient, { schema })
export type DB = typeof db
