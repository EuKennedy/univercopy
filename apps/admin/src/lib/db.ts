import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './db/schema'

// Cliente Postgres compartilhado. Pool: 5 conexões (admin é low-throughput,
// auth + queries de UI; API Rails é onde mora o domain throughput).
// `prepare: false` permite usar atrás de PgBouncer em transaction mode.
//
// Init LAZY: o cliente é construído na primeira chamada real, não no
// module evaluation. Sem isso, `next build` em CI (sem DATABASE_URL no
// ambiente) estourava na collection de page data.

type Schema = typeof schema
type DBInstance = PostgresJsDatabase<Schema>

let cached: DBInstance | null = null

function getDb(): DBInstance {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL env required for admin app — drizzle/Better Auth need it.')
  }
  cached = drizzle(postgres(url, { max: 5, prepare: false }), { schema })
  return cached
}

export const db: DBInstance = new Proxy({} as DBInstance, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>
    const value = real[prop as string | symbol]
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(real) : value
  },
})

export type DB = DBInstance
