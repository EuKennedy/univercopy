import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import { generate as callClaude } from "../claude.js";
import { parseJsonBlock } from "../json.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

async function fetchText(url: string): Promise<string> {
  const full = url.startsWith("http") ? url : "https://" + url;
  const res = await fetch(full, { headers: { "user-agent": "UniverCopyBot/1.0" } });
  const html = await res.text();
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

// PRINCÍPIO INEGOCIÁVEL: extrai PADRÃO/ESTRUTURA/ESTRATÉGIA — nunca o texto.
const EXTRACT = `Você é analista de inteligência competitiva de e-commerce de beleza. A partir do conteúdo REAL de uma PDP de CONCORRENTE, extraia INTELIGÊNCIA ESTRUTURAL — padrão, estrutura e estratégia. NUNCA reproduza, parafraseie de perto ou copie o texto do concorrente: descreva em análise própria. Guarde só insights estruturais (ex.: "organiza a PDP em 6 blocos, abre pela dor, destaca 3 ativos com função").
Responda APENAS em JSON válido:
{"produto":"","preco":"","estrutura_pdp":{"descricao_curta":"presente|ausente","descricao_longa":"presente|ausente","ativos":"presente|ausente","antes_depois":"presente|ausente","video":"presente|ausente","faq":"presente|ausente","avaliacoes":"presente|ausente","tabela_tecnica":"presente|ausente","modo_uso":"presente|ausente","cross_sell":"presente|ausente"},"copy":{"angulo":"","framework_aparente":"","concern":"","beneficio_central":"","mecanismo":""},"ativos":[{"nome":"","apresentacao":"so-nome|nome+funcao|nome+funcao+origem"}],"seo":{"padrao_meta_title":"","keyword_aparente":"","headings":"","schema":""},"geo":{"tem_faq":true,"respostas_autonomas":true,"densidade_factual":"alta|media|baixa","linguagem_conversacional":true,"schema_faqpage":false},"score_competitivo":<0-100>,"faixa":"competitivo|bom|fraco|critico","observacoes":"análise própria — destaques e fraquezas (sem citar copy literal)"}`;

// Ingere PDPs de concorrentes → inteligência estrutural (sem copiar texto).
r.post("/workspaces/:id/intelligence/ingest", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const b = await c.req.json<{ urls?: string[]; marca?: string; categoria?: string }>();
  const urls = (b.urls || []).map((u) => (u || "").trim()).filter(Boolean).slice(0, 3);
  if (!urls.length) return c.json({ error: "informe ao menos uma URL" }, 400);

  const registros: unknown[] = [];
  const avisos: string[] = [];
  for (const url of urls) {
    try {
      const text = await fetchText(url);
      const out = await callClaude(`${EXTRACT}\n\nURL: ${url}\nConteúdo extraído:\n${text}`, 3000);
      const rec = parseJsonBlock<Record<string, unknown>>(out.text);
      const saved = await withUser(uid, (cl) => cl.query(
        `insert into intelligence_record(workspace_id, marca, produto, categoria, preco, url, estrutura_pdp, copy, ativos, seo, geo, score_competitivo, faixa, observacoes, created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id, marca, produto, categoria, url, estrutura_pdp, copy, ativos, seo, geo, score_competitivo, faixa, observacoes, collected_at`,
        [ws, b.marca ?? (rec.marca as string) ?? null, rec.produto ?? null, b.categoria ?? null, rec.preco ?? null, url,
         JSON.stringify(rec.estrutura_pdp ?? {}), JSON.stringify(rec.copy ?? {}), JSON.stringify(rec.ativos ?? []),
         JSON.stringify(rec.seo ?? {}), JSON.stringify(rec.geo ?? {}),
         typeof rec.score_competitivo === "number" ? rec.score_competitivo : null, rec.faixa ?? null, rec.observacoes ?? null, uid]
      ));
      registros.push(saved.rows[0]);
    } catch (e) {
      avisos.push(`Falha em ${url}: ${String(e)}`);
    }
  }
  return c.json({ ok: true, ingeridos: registros.length, registros, avisos });
});

// Lista os registros de inteligência do workspace (opcional: por categoria).
r.get("/workspaces/:id/intelligence", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const cat = c.req.query("categoria");
  const out = await withUser(uid, (cl) =>
    cl.query(
      `select id, marca, produto, categoria, preco, url, estrutura_pdp, copy, ativos, seo, geo, score_competitivo, faixa, observacoes, collected_at
       from intelligence_record where workspace_id=$1 ${cat ? "and categoria=$2" : ""} order by collected_at desc`,
      cat ? [ws, cat] : [ws]
    ));
  return c.json(out.rows);
});

export default r;
