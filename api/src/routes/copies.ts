import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

// Lista o acervo do workspace (com o conteúdo da versão atual).
r.get("/workspaces/:id/copies", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const out = await withUser(uid, (cl) =>
    cl.query(
      `select c.*, v.content as current_content
       from copy c
       left join copy_version v on v.copy_id = c.id and v.is_current
       where c.workspace_id = $1 order by c.updated_at desc`,
      [ws]
    ));
  return c.json(out.rows);
});

// Cria uma copy + primeira versão.
r.post("/workspaces/:id/copies", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const b = await c.req.json<{
    title: string; content: string; category_key?: string; piece_type_key?: string;
    style_key?: string; framework_key?: string; product_id?: string; tags?: string[]; campaign_id?: string;
  }>();
  const out = await withUser(uid, async (cl) => {
    const copy = (await cl.query(
      `insert into copy(workspace_id, product_id, category_key, piece_type_key, title, style_key, framework_key, tags, created_by, campaign_id)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
      [ws, b.product_id ?? null, b.category_key ?? null, b.piece_type_key ?? null,
       b.title, b.style_key ?? null, b.framework_key ?? null, JSON.stringify(b.tags ?? []), uid, b.campaign_id ?? null]
    )).rows[0];
    await cl.query(
      `insert into copy_version(copy_id, n, content, author_id, note, is_current)
       values($1, 1, $2, $3, 'Criação', true)`,
      [copy.id, b.content ?? "", uid]
    );
    return copy;
  });
  return c.json(out, 201);
});

// Nova versão (vira a atual).
r.post("/copies/:cid/versions", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  const b = await c.req.json<{ content: string; note?: string }>();
  const out = await withUser(uid, async (cl) => {
    await cl.query("update copy_version set is_current = false where copy_id = $1", [cid]);
    const n = (await cl.query("select coalesce(max(n),0)+1 as n from copy_version where copy_id = $1", [cid])).rows[0].n;
    const v = (await cl.query(
      `insert into copy_version(copy_id, n, content, author_id, note, is_current)
       values($1,$2,$3,$4,$5,true) returning *`,
      [cid, n, b.content, uid, b.note ?? "Nova versão"]
    )).rows[0];
    await cl.query("update copy set updated_at = now() where id = $1", [cid]);
    return v;
  });
  return c.json(out, 201);
});

// Muda o status (rascunho|revisao|aprovado|publicado).
r.patch("/copies/:cid/status", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  const { status } = await c.req.json<{ status: string }>();
  const out = await withUser(uid, (cl) =>
    cl.query("update copy set status = $2, updated_at = now() where id = $1 returning *", [cid, status]));
  return out.rows[0] ? c.json(out.rows[0]) : c.json({ error: "not found" }, 404);
});

r.get("/copies/:cid/comments", async (c) => {
  const uid = c.get("userId");
  const out = await withUser(uid, (cl) =>
    cl.query("select * from comment where copy_id = $1 order by created_at", [c.req.param("cid")]));
  return c.json(out.rows);
});

r.post("/copies/:cid/comments", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  const { text } = await c.req.json<{ text: string }>();
  const out = await withUser(uid, (cl) =>
    cl.query("insert into comment(copy_id, author_id, text) values($1,$2,$3) returning *", [cid, uid, text]));
  return c.json(out.rows[0], 201);
});

// Histórico de versões de uma copy.
r.get("/copies/:cid/versions", async (c) => {
  const uid = c.get("userId");
  const out = await withUser(uid, (cl) =>
    cl.query(
      "select n, content, note, author_id, is_current, created_at from copy_version where copy_id = $1 order by n desc",
      [c.req.param("cid")]
    ));
  return c.json(out.rows);
});

// Exclui definitivamente uma copy (com versões e comentários).
r.delete("/copies/:cid", async (c) => {
  const uid = c.get("userId"); const cid = c.req.param("cid");
  await withUser(uid, async (cl) => {
    await cl.query("delete from comment where copy_id = $1", [cid]);
    await cl.query("delete from copy_version where copy_id = $1", [cid]);
    await cl.query("delete from copy where id = $1", [cid]);
  });
  return c.json({ ok: true });
});

export default r;
