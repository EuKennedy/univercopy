import { Hono } from "hono";
import type { PoolClient } from "pg";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import { generate as callClaude } from "../claude.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

const FIELDS = ["marca","missao","posicionamento","tom","publico","consciencia","framework","source_url"];
const LISTS = ["valores","produtos","ofertas","provas","objecoes","evitar"];

// Upsert de um DNA (atual|proposto) a partir de um objeto com os campos.
async function upsertDna(cl: PoolClient, ws: string, kind: string, b: Record<string, unknown>) {
  const cols = ["workspace_id","kind",...FIELDS,...LISTS];
  const vals: unknown[] = [ws, kind,
    ...FIELDS.map((f) => b[f] ?? null),
    ...LISTS.map((f) => JSON.stringify(b[f] ?? [])),
  ];
  const ph = cols.map((_, i) => `$${i + 1}`).join(",");
  const upd = [...FIELDS, ...LISTS].map((f) => `${f} = excluded.${f}`).join(", ");
  const out = await cl.query(
    `insert into brand_dna(${cols.join(",")}) values(${ph})
     on conflict(workspace_id, kind) do update set ${upd}, updated_at = now()
     returning *`,
    vals
  );
  return out.rows[0];
}

const asArr = (v: unknown): string[] =>
  Array.isArray(v) ? (v as string[])
  : typeof v === "string" ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : (v ? [v] : []); } catch { return v ? [v] : []; } })()
  : [];

// Extrai o primeiro objeto JSON de um texto e faz parse.
function parseJsonBlock(text: string): Record<string, unknown> {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(json);
}

const DNA_JSON_KEYS =
  `{"marca":"","missao":"","posicionamento":"","tom":"","publico":"","consciencia":"","valores":[],"produtos":[],"ofertas":[],"provas":[],"objecoes":[],"evitar":[]}`;

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
  const out = await withUser(uid, (cl) => upsertDna(cl, ws, kind, b));
  return c.json(out);
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

// Gera o DNA ATUAL a partir do conteúdo real de uma URL (scraping + Claude).
r.post("/workspaces/:id/dna/from-url", async (c) => {
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
      .slice(0, 8000);
  } catch (e) {
    return c.json({ error: "falha ao buscar a URL", detail: String(e) }, 502);
  }

  const prompt =
    `Você é estrategista de marca e copywriter sênior. A partir do conteúdo REAL do site abaixo, extraia o DNA da marca.\n` +
    `Responda APENAS em JSON válido com estas chaves (strings simples e listas como arrays de strings):\n${DNA_JSON_KEYS}\n` +
    `Regras: baseie-se SOMENTE no que o site comunica (não invente fatos); "consciencia" = estágio de consciência do público; "objecoes" = objeção do cliente + como responder; "evitar" = palavras/clichês que a marca deveria evitar.\n\n` +
    `URL: ${url}\nConteúdo extraído do site:\n${pageText}`;

  let parsed: Record<string, unknown>;
  try {
    const out = await callClaude(prompt, 2000);
    parsed = parseJsonBlock(out.text);
  } catch (e) {
    return c.json({ error: "falha ao analisar o site", detail: String(e) }, 502);
  }
  parsed.source_url = url;

  const saved = await withUser(uid, async (cl) => {
    const row = await upsertDna(cl, ws, "atual", parsed);
    const marca = typeof parsed.marca === "string" ? parsed.marca.trim() : "";
    if (marca) await cl.query("update workspace set name = $2, site_url = $3, updated_at = now() where id = $1", [ws, marca, url]);
    else await cl.query("update workspace set site_url = $2, updated_at = now() where id = $1", [ws, url]);
    return row;
  });
  return c.json(saved);
});

// Gera/aprimora o DNA PROPOSTO a partir do Atual (framework + direção, via Claude).
r.post("/workspaces/:id/dna/improve", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const { framework, direction } = await c.req.json<{ framework?: string; direction?: string }>();

  const src = await withUser(uid, async (cl) =>
    (await cl.query("select * from brand_dna where workspace_id = $1 and kind = 'atual'", [ws])).rows[0] || {});
  const srcObj = {
    marca: src.marca, missao: src.missao, posicionamento: src.posicionamento, tom: src.tom,
    publico: src.publico, consciencia: src.consciencia,
    valores: asArr(src.valores), produtos: asArr(src.produtos), ofertas: asArr(src.ofertas),
    provas: asArr(src.provas), objecoes: asArr(src.objecoes), evitar: asArr(src.evitar),
  };

  const prompt =
    `Você é estrategista de marca sênior. A partir do DNA ATUAL abaixo, gere uma versão PROPOSTA mais forte` +
    (framework ? `, estruturada segundo o framework "${framework}"` : "") +
    (direction ? `. Direção desejada do aprimoramento: ${direction}` : "") + `.\n` +
    `Cada campo deve ficar mais específico, concreto e persuasivo, SEM inventar fatos novos.\n` +
    `Responda APENAS em JSON válido com as chaves:\n${DNA_JSON_KEYS}\n\n` +
    `DNA ATUAL:\n${JSON.stringify(srcObj)}`;

  let parsed: Record<string, unknown>;
  try {
    const out = await callClaude(prompt, 2000);
    parsed = parseJsonBlock(out.text);
  } catch (e) {
    return c.json({ error: "falha ao aprimorar o DNA", detail: String(e) }, 502);
  }
  if (framework) parsed.framework = framework;

  const saved = await withUser(uid, (cl) => upsertDna(cl, ws, "proposto", parsed));
  return c.json(saved);
});

export default r;
