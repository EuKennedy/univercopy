import pg from "pg";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// Executa uma função dentro de uma transação com app.user_id setado,
// para que as políticas de RLS (is_member) reconheçam o usuário corrente.
export async function withUser<T>(
  userId: string | null,
  fn: (c: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    // is_local = true: vale apenas dentro desta transação.
    await client.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
