import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import { buildPrompt } from "../prompt.js";
import { generate as callClaude } from "../claude.js";
import { wooListProducts, wooUpdateProduct, type WooCfg, type WooProduct } from "../lib/woo.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

// Conectar a loja WooCommerce ao workspace.
// NOTA: em produção, cifrar key/secret (KMS/Vault) antes de gravar em config.
r.post("/workspaces/:id/integrations/woocommerce", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const { url, key, secret } = await c.req.json<WooCfg>();
  if (!url || !key || !secret) return c.json({ error: "url, key e secret obrigatórios" }, 400);
  const out = await withUser(uid, (cl) =>
    cl.query(
      `insert into integration(workspace_id, type, config, status)
       values($1, 'woocommerce', $2, 'connected')
       on conflict(workspace_id, type) do update set config = excluded.config, status = 'connected'
       returning id, type, status`,
      [ws, JSON.stringify({ url, key, secret })]
    ));
  return c.json(out.rows[0]);
});

async function getWoo(cl: import("pg").PoolClient, ws: string): Promise<WooCfg> {
  const row = (await cl.query(
    "select config from integration where workspace_id = $1 and type = 'woocommerce'", [ws]
  )).rows[0];
  if (!row) throw new Error("WooCommerce não conectado neste workspace");
  return row.config as WooCfg;
}

// Sincroniza o catálogo (paginação completa) para a tabela product.
r.post("/workspaces/:id/products/sync", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  try {
    const count = await withUser(uid, async (cl) => {
      const cfg = await getWoo(cl, ws);
      let page = 1, total = 1, n = 0;
      do {
        const { items, totalPages } = await wooListProducts(cfg, page, 50);
        total = totalPages;
        for (const p of items as WooProduct[]) {
          await cl.query(
            `insert into product(workspace_id, source, external_id, sku, name, description, short_description, price, permalink, categories, images, rating_avg, reviews_count, synced_at)
             values($1,'woocommerce',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
             on conflict(workspace_id, source, external_id) do update set
               name=excluded.name, description=excluded.description, short_description=excluded.short_description,
               price=excluded.price, permalink=excluded.permalink, categories=excluded.categories,
               images=excluded.images, rating_avg=excluded.rating_avg, reviews_count=excluded.reviews_count, synced_at=now()`,
            [ws, String(p.id), p.sku ?? null, p.name, p.description ?? null, p.short_description ?? null,
             p.price ? Number(p.price) : null, p.permalink ?? null,
             JSON.stringify((p.categories || []).map((x) => x.name)),
             JSON.stringify((p.images || []).map((x) => x.src)),
             p.average_rating ? Number(p.average_rating) : null, p.rating_count ?? 0]
          );
          n++;
        }
        page++;
      } while (page <= total);
      await cl.query("update integration set last_sync_at = now() where workspace_id = $1 and type='woocommerce'", [ws]);
      return n;
    });
    return c.json({ ok: true, synced: count });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

r.get("/workspaces/:id/products", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const out = await withUser(uid, (cl) =>
    cl.query("select id, external_id, sku, name, price, rating_avg, reviews_count, synced_at from product where workspace_id = $1 order by name", [ws]));
  return c.json(out.rows);
});

// Geração em lote de descrições para os produtos sem copy ainda (limite de segurança).
r.post("/workspaces/:id/products/bulk-generate", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const b = await c.req.json<{ pieceTypeKey?: string; limit?: number }>();
  const limit = Math.min(Math.max(b.limit ?? 10, 1), 25);
  const ctx = await withUser(uid, async (cl) => {
    const wsRow = (await cl.query("select settings from workspace where id=$1", [ws])).rows[0];
    const inUse = (wsRow?.settings?.dna_in_use) || "atual";
    const dna = (await cl.query("select * from brand_dna where workspace_id=$1 and kind=$2", [ws, inUse])).rows[0] || {};
    const piece = b.pieceTypeKey ? (await cl.query("select * from piece_type where key=$1", [b.pieceTypeKey])).rows[0] : null;
    const style = piece?.default_style ? (await cl.query("select * from style where key=$1", [piece.default_style])).rows[0] : null;
    const fw = piece?.default_framework ? (await cl.query("select * from framework where key=$1", [piece.default_framework])).rows[0] : null;
    const prods = (await cl.query(
      `select p.* from product p
       where p.workspace_id=$1 and not exists (select 1 from copy c where c.product_id = p.id)
       order by p.reviews_count desc nulls last limit $2`, [ws, limit])).rows;
    return { dna, piece, style, fw, prods };
  });

  const results: { product: string; ok: boolean }[] = [];
  for (const prod of ctx.prods) {
    try {
      const { full } = buildPrompt({
        dna: ctx.dna, pieceType: ctx.piece, style: ctx.style, framework: ctx.fw,
        brief: prod.name, product: { name: prod.name, description: prod.description },
      });
      const out = await callClaude(full);
      const content = out.variations[0] || out.text;
      await withUser(uid, async (cl) => {
        const copy = (await cl.query(
          `insert into copy(workspace_id, product_id, category_key, piece_type_key, title, style_key, framework_key, created_by)
           values($1,$2,'ecom',$3,$4,$5,$6,$7) returning id`,
          [ws, prod.id, ctx.piece?.key ?? null, `${prod.name}`.slice(0, 60),
           ctx.style?.key ?? null, ctx.fw?.key ?? null, uid]
        )).rows[0];
        await cl.query(
          "insert into copy_version(copy_id, n, content, author_id, note, is_current) values($1,1,$2,$3,'Geração em lote',true)",
          [copy.id, content, uid]
        );
        await cl.query(
          "insert into generation(workspace_id, copy_id, model, output, prompt_tokens, output_tokens, created_by) values($1,$2,$3,$4,$5,$6,$7)",
          [ws, copy.id, process.env.CLAUDE_MODEL || "claude-sonnet-4-6", out.text, out.usage.input, out.usage.output, uid]
        );
      });
      results.push({ product: prod.name, ok: true });
    } catch {
      results.push({ product: prod.name, ok: false });
    }
  }
  return c.json({ processed: results.length, results });
});

// Publica uma copy aprovada de volta no WooCommerce (description/short_description).
r.post("/products/:pid/publish", async (c) => {
  const uid = c.get("userId"); const pid = c.req.param("pid");
  const b = await c.req.json<{ field?: "description" | "short_description"; content: string }>();
  try {
    const result = await withUser(uid, async (cl) => {
      const prod = (await cl.query("select * from product where id=$1", [pid])).rows[0];
      if (!prod) throw new Error("produto não encontrado");
      const cfg = await getWoo(cl, prod.workspace_id);
      const field = b.field || "description";
      return wooUpdateProduct(cfg, Number(prod.external_id), { [field]: b.content });
    });
    return c.json({ ok: true, woo: { id: (result as { id: number }).id } });
  } catch (e) {
    return c.json({ error: String(e) }, 502);
  }
});

export default r;
