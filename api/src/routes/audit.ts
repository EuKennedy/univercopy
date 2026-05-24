import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import { generate as callClaude } from "../claude.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

// Auditoria de página: busca a URL no servidor, extrai o texto e pede ao
// Claude um diagnóstico por seção com proposta de melhoria.
r.post("/workspaces/:id/audit", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const { url } = await c.req.json<{ url: string }>();
  if (!url) return c.json({ error: "url obrigatória" }, 400);

  let pageText = "";
  try {
    const full = url.startsWith("http") ? url : "https://" + url;
    const res = await fetch(full, { headers: { "user-agent": "UniverCopyBot/1.0" } });
    const html = await res.text();
    pageText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch (e) {
    return c.json({ error: "falha ao buscar a URL", detail: String(e) }, 502);
  }

  const dna = await withUser(uid, async (cl) => {
    const wsRow = (await cl.query("select settings from workspace where id = $1", [ws])).rows[0];
    const inUse = (wsRow?.settings?.dna_in_use) || "atual";
    return (await cl.query("select * from brand_dna where workspace_id = $1 and kind = $2", [ws, inUse])).rows[0] || {};
  });

  const prompt =
    `Você é um auditor de copy sênior. Analise o conteúdo da página abaixo, à luz do DNA da marca, e produza uma auditoria.\n` +
    `Responda APENAS em JSON válido: {"score":<0-100>,"summary":"...","sections":[{"nome":"...","sev":"alto|médio|baixo","atual":"...","diag":["..."],"recomendacao":"..."}]}\n\n` +
    `DNA da marca: ${JSON.stringify({ marca: dna.marca, posicionamento: dna.posicionamento, tom: dna.tom, publico: dna.publico, evitar: dna.evitar })}\n\n` +
    `URL: ${url}\nConteúdo (texto extraído):\n${pageText}`;

  let parsed: unknown;
  try {
    const out = await callClaude(prompt, 2000);
    const json = out.text.slice(out.text.indexOf("{"), out.text.lastIndexOf("}") + 1);
    parsed = JSON.parse(json);
  } catch (e) {
    return c.json({ error: "falha ao analisar", detail: String(e) }, 502);
  }

  const p = parsed as { score?: number; summary?: string; sections?: unknown[] };
  const saved = await withUser(uid, (cl) =>
    cl.query(
      `insert into audit(workspace_id, url, brand_name, score, summary, sections, created_by)
       values($1,$2,$3,$4,$5,$6,$7) returning *`,
      [ws, url, dna.marca ?? null, p.score ?? null, p.summary ?? null, JSON.stringify(p.sections ?? []), uid]
    ));
  return c.json(saved.rows[0]);
});

export default r;
