import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

const FIELDS = ["marca","missao","posicionamento","tom","publico","consciencia","framework","source_url"];
const LISTS = ["valores","produtos","ofertas","provas","objecoes","evitar"];

// Lê os dois DNAs (atual/proposto) + qual está em uso.
r.get("/workspaces/:id/dna", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const out = await withUser(uid, async (cl) => {
    const dna = (await cl.query("select * from brand_dna where workspace_id = $1", [ws])).rows;
    const w = (await cl.query("select settings from workspace where id = $1", [ws])).rows[0];
    return { dna, in_use: (w?.settings?.dna_in_use) || "atual" };
  });
  return c.json(out);
});

// Salva (upsert) um DNA (atual|proposto).
r.put("/workspaces/:id/dna/:kind", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id"); const kind = c.req.param("kind");
  if (kind !== "atual" && kind !== "proposto") return c.json({ error: "kind inválido" }, 400);
  const b = await c.req.json<Record<string, unknown>>();
  const cols = ["workspace_id","kind",...FIELDS,...LISTS];
  const vals: unknown[] = [ws, kind,
    ...FIELDS.map((f) => b[f] ?? null),
    ...LISTS.map((f) => JSON.stringify(b[f] ?? [])),
  ];
  const ph = cols.map((_, i) => `$${i + 1}`).join(",");
  const upd = [...FIELDS, ...LISTS].map((f) => `${f} = excluded.${f}`).join(", ");
  const out = await withUser(uid, (cl) =>
    cl.query(
      `insert into brand_dna(${cols.join(",")}) values(${ph})
       on conflict(workspace_id, kind) do update set ${upd}, updated_at = now()
       returning *`,
      vals
    ));
  return c.json(out.rows[0]);
});

// Define qual DNA alimenta o Gerador.
r.post("/workspaces/:id/dna/use", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const { kind } = await c.req.json<{ kind: string }>();
  if (kind !== "atual" && kind !== "proposto") return c.json({ error: "kind inválido" }, 400);
  await withUser(uid, (cl) =>
    cl.query(
      "update workspace set settings = jsonb_set(coalesce(settings,'{}'), '{dna_in_use}', to_jsonb($2::text)) where id = $1",
      [ws, kind]
    ));
  return c.json({ ok: true, in_use: kind });
});

export default r;
