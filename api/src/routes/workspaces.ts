import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

// Lista os workspaces do usuário corrente.
r.get("/workspaces", async (c) => {
  const uid = c.get("userId");
  const rows = await withUser(uid, (cl) =>
    cl.query(
      `select w.* from workspace w
       join workspace_member m on m.workspace_id = w.id
       where m.user_id = $1 order by w.created_at`,
      [uid]
    )
  );
  return c.json(rows.rows);
});

// Cria um workspace (usa a função SECURITY DEFINER, que também cria o owner e o DNA).
r.post("/workspaces", async (c) => {
  const uid = c.get("userId");
  const body = await c.req.json<{ name: string; slug?: string; icon?: string; site_url?: string }>();
  if (!body?.name) return c.json({ error: "name obrigatório" }, 400);
  const out = await withUser(uid, (cl) =>
    cl.query("select * from create_workspace($1,$2,$3,$4)", [
      body.name, body.slug ?? null, body.icon ?? null, body.site_url ?? null,
    ])
  );
  return c.json(out.rows[0], 201);
});

r.get("/workspaces/:id", async (c) => {
  const uid = c.get("userId");
  const out = await withUser(uid, (cl) =>
    cl.query("select * from workspace where id = $1", [c.req.param("id")]));
  return out.rows[0] ? c.json(out.rows[0]) : c.json({ error: "not found" }, 404);
});

r.patch("/workspaces/:id", async (c) => {
  const uid = c.get("userId");
  const b = await c.req.json<{ name?: string; icon?: string; site_url?: string; settings?: unknown }>();
  const out = await withUser(uid, (cl) =>
    cl.query(
      `update workspace set
         name = coalesce($2, name), icon = coalesce($3, icon),
         site_url = coalesce($4, site_url),
         settings = coalesce($5, settings), updated_at = now()
       where id = $1 returning *`,
      [c.req.param("id"), b.name ?? null, b.icon ?? null, b.site_url ?? null, b.settings ?? null]
    ));
  return out.rows[0] ? c.json(out.rows[0]) : c.json({ error: "not found" }, 404);
});

r.delete("/workspaces/:id", async (c) => {
  const uid = c.get("userId");
  await withUser(uid, (cl) => cl.query("delete from workspace where id = $1", [c.req.param("id")]));
  return c.json({ ok: true });
});

// Membros
r.get("/workspaces/:id/members", async (c) => {
  const uid = c.get("userId");
  const out = await withUser(uid, (cl) =>
    cl.query(
      `select m.role, u.id, u.email, u.name from workspace_member m
       join app_user u on u.id = m.user_id where m.workspace_id = $1`,
      [c.req.param("id")]
    ));
  return c.json(out.rows);
});

export default r;
