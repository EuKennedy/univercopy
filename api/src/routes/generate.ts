import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import { buildPrompt } from "../prompt.js";
import { generate as callClaude } from "../claude.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

// Geração server-side: carrega o contexto do workspace, monta o prompt em
// camadas, chama o Claude, registra a generation e devolve as variações.
r.post("/workspaces/:id/generate", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const b = await c.req.json<{
    brief: string; pieceTypeKey?: string; categoryKey?: string;
    styleKey?: string; frameworkKey?: string; referenceId?: string; productId?: string;
  }>();

  const ctx = await withUser(uid, async (cl) => {
    const wsRow = (await cl.query("select settings from workspace where id = $1", [ws])).rows[0];
    const inUse = (wsRow?.settings?.dna_in_use) || "atual";
    const dna = (await cl.query("select * from brand_dna where workspace_id = $1 and kind = $2", [ws, inUse])).rows[0] || {};
    const piece = b.pieceTypeKey ? (await cl.query("select * from piece_type where key = $1", [b.pieceTypeKey])).rows[0] : null;
    const styleKey = b.styleKey || piece?.default_style;
    const fwKey = b.frameworkKey || piece?.default_framework;
    const style = styleKey ? (await cl.query("select * from style where key = $1", [styleKey])).rows[0] : null;
    const framework = fwKey ? (await cl.query("select * from framework where key = $1", [fwKey])).rows[0] : null;
    const reference = b.referenceId ? (await cl.query("select * from reference_item where id = $1", [b.referenceId])).rows[0] : null;
    const product = b.productId ? (await cl.query("select * from product where id = $1", [b.productId])).rows[0] : null;
    return { inUse, dna, piece, style, framework, reference, product, styleKey, fwKey };
  });

  const { full, layers } = buildPrompt({
    dna: ctx.dna,
    pieceType: ctx.piece,
    style: ctx.style,
    framework: ctx.framework,
    brief: b.brief || (ctx.product?.name ?? "a peça"),
    reference: ctx.reference ? { title: ctx.reference.title, source: ctx.reference.source, notes: ctx.reference.notes } : null,
    product: ctx.product ? { name: ctx.product.name, description: ctx.product.description } : null,
    reviews: [],
  });

  let result;
  try {
    result = await callClaude(full);
  } catch (e) {
    return c.json({ error: "falha na geração", detail: String(e) }, 502);
  }

  await withUser(uid, (cl) =>
    cl.query(
      `insert into generation(workspace_id, model, prompt, output, prompt_tokens, output_tokens, created_by)
       values($1, $2, $3, $4, $5, $6, $7)`,
      [ws, process.env.CLAUDE_MODEL || "claude-sonnet-4-6",
       JSON.stringify({ layers }), result.text, result.usage.input, result.usage.output, uid]
    ));

  return c.json({
    variations: result.variations,
    used: { style: ctx.styleKey, framework: ctx.fwKey, piece: b.pieceTypeKey, dna: ctx.inUse },
    promptLayers: layers,
  });
});

export default r;
