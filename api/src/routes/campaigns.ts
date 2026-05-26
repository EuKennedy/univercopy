import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

// Cria uma campanha.
r.post("/workspaces/:id/campaigns", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const b = await c.req.json<{ name?: string; objective?: string; audience?: string; status?: string; starts_at?: string; ends_at?: string }>();
  if (!b?.name) return c.json({ error: "name obrigatório" }, 400);
  const out = await withUser(uid, (cl) =>
    cl.query(
      `insert into campaign(workspace_id, name, objective, audience, status, starts_at, ends_at, created_by)
       values($1,$2,$3,$4,coalesce($5,'planejada'),$6,$7,$8) returning *`,
      [ws, b.name, b.objective ?? null, b.audience ?? null, b.status ?? null, b.starts_at || null, b.ends_at || null, uid]
    ));
  return c.json(out.rows[0], 201);
});

// Lista as campanhas do workspace (com contagem de peças).
r.get("/workspaces/:id/campaigns", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const out = await withUser(uid, (cl) =>
    cl.query(
      `select c.*, (select count(*)::int from copy where campaign_id = c.id) as pieces
       from campaign c where c.workspace_id = $1 order by c.created_at desc`, [ws]));
  return c.json(out.rows);
});

// Detalhe da campanha + suas peças (copies) com o conteúdo atual.
r.get("/campaigns/:cid", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  const out = await withUser(uid, async (cl) => {
    const camp = (await cl.query("select * from campaign where id = $1", [cid])).rows[0];
    if (!camp) return null;
    const copies = (await cl.query(
      `select c.*, v.content as current_content
       from copy c left join copy_version v on v.copy_id = c.id and v.is_current
       where c.campaign_id = $1 order by c.category_key, c.updated_at desc`, [cid])).rows;
    return { campaign: camp, copies };
  });
  return out ? c.json(out) : c.json({ error: "not found" }, 404);
});

// Atualiza a campanha.
r.patch("/campaigns/:cid", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  const b = await c.req.json<{ name?: string; objective?: string; audience?: string; status?: string; starts_at?: string; ends_at?: string }>();
  const out = await withUser(uid, (cl) =>
    cl.query(
      `update campaign set
         name = coalesce($2, name), objective = coalesce($3, objective), audience = coalesce($4, audience),
         status = coalesce($5, status), starts_at = coalesce($6, starts_at), ends_at = coalesce($7, ends_at),
         updated_at = now()
       where id = $1 returning *`,
      [cid, b.name ?? null, b.objective ?? null, b.audience ?? null, b.status ?? null, b.starts_at || null, b.ends_at || null]
    ));
  return out.rows[0] ? c.json(out.rows[0]) : c.json({ error: "not found" }, 404);
});

// Exclui a campanha (as peças continuam no acervo, com campaign_id zerado).
r.delete("/campaigns/:cid", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  await withUser(uid, (cl) => cl.query("delete from campaign where id = $1", [cid]));
  return c.json({ ok: true });
});

// Anexa/desanexa uma copy a uma campanha.
r.patch("/copies/:cid/campaign", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  const { campaign_id } = await c.req.json<{ campaign_id?: string | null }>();
  const out = await withUser(uid, (cl) =>
    cl.query("update copy set campaign_id = $2, updated_at = now() where id = $1 returning id, campaign_id", [cid, campaign_id ?? null]));
  return out.rows[0] ? c.json(out.rows[0]) : c.json({ error: "not found" }, 404);
});

export default r;
