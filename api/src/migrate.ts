import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

// Inicializa o banco no boot da API caso o schema ainda não exista.
// Útil quando o ambiente (ex.: Coolify) não executa os scripts de
// /docker-entrypoint-initdb.d do Postgres. Idempotente: só aplica
// schema + seed quando a tabela `style` não está presente.
export async function migrate(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url)); // /app/dist em produção
  const sqlDir = resolve(here, "../sql"); // /app/sql (copiado no Dockerfile)

  const client = await pool.connect();
  try {
    const exists = await client.query(
      "select to_regclass('public.style') as t"
    );
    if (exists.rows[0]?.t) {
      console.log("[migrate] schema já existe — pulando init.");
      return;
    }

    console.log("[migrate] schema ausente — aplicando 01_schema.sql + 02_seed.sql…");
    const schema = readFileSync(resolve(sqlDir, "01_schema.sql"), "utf8");
    const seed = readFileSync(resolve(sqlDir, "02_seed.sql"), "utf8");

    // Simple query protocol: suporta múltiplos statements e corpos $$…$$.
    await client.query(schema);
    await client.query(seed);

    const styles = await client.query("select count(*)::int as n from style");
    console.log(`[migrate] concluído. styles=${styles.rows[0]?.n}`);
  } catch (e) {
    console.error("[migrate] falhou:", e);
    throw e;
  } finally {
    client.release();
  }
}
