import { Hono } from "hono";
import { withUser } from "../db.js";
import { auth } from "../auth.js";
import { generate as callClaude } from "../claude.js";
import type { Env } from "../types.js";

const r = new Hono<Env>();
r.use("*", auth);

// Playbook SEO+GEO por categoria de produto (Doc v1.0, seção 6).
const PLAYBOOK: Record<string, { kw: string; geoq: string; blocos: string; schema: string; faq: string }> = {
  progressiva: {
    kw: "progressiva profissional; progressiva sem formol; alisamento capilar profissional; progressiva para cabelo cacheado; [produto] 1 litro",
    geoq: "qual a melhor progressiva profissional sem formol?; progressiva dura quanto tempo?; progressiva resseca o cabelo?; qual progressiva usar em cabelo loiro descolorido?; diferença entre progressiva e escova progressiva",
    blocos: "definição direta (o que é/como funciona); tabela de compatibilidade (tipo de cabelo × química); tempo de duração como fato; rendimento por litro; FAQ de segurança",
    schema: "Product + FAQPage",
    faq: "Pode usar em cabelo com química?; Quanto tempo dura o efeito?; Resseca o cabelo?; Rende quantas aplicações por litro?",
  },
  shampoo: {
    kw: "shampoo detox quelante; shampoo antirresíduo profissional; shampoo reconstrutor; shampoo para [concern]",
    geoq: "para que serve shampoo quelante?; com que frequência usar shampoo detox?; qual shampoo usar antes da progressiva?; shampoo detox resseca?",
    blocos: "'para que serve' em uma frase; frequência de uso como fato; pH declarado; livre-de (sal, sulfato) como fatos; comparação detox × shampoo comum",
    schema: "Product + FAQPage",
    faq: "Para que serve?; Com que frequência usar?; Resseca o cabelo?; Serve para o meu tipo de cabelo?",
  },
  mascara: {
    kw: "máscara hidratação profunda; máscara reconstrução capilar; máscara de nutrição; [produto] cronograma capilar",
    geoq: "qual máscara usar na etapa de reconstrução?; diferença entre hidratação, nutrição e reconstrução; com que frequência usar máscara capilar?; melhor máscara para cabelo danificado por química?",
    blocos: "posição no cronograma como fato; definição dos três pilares; tabela de quando usar; tempo de pausa; FAQ de frequência",
    schema: "Product + FAQPage + HowTo (modo de uso)",
    faq: "Hidrata, nutre ou reconstrói?; Com que frequência usar?; Quanto tempo deixar agir?; Pode usar em cabelo com química?",
  },
  finalizador: {
    kw: "sérum capilar; leave-in profissional; protetor térmico capilar; spray de brilho capilar",
    geoq: "para que serve sérum capilar?; diferença entre leave-in e sérum; leave-in pesa o cabelo?; qual protetor térmico usar antes da chapinha?",
    blocos: "'para que serve' direto; aplicação em cabelo úmido ou seco como fato; quantidade de uso; FAQ 'pesa?'",
    schema: "Product + FAQPage",
    faq: "Pesa ou engordura o cabelo?; Quanto usar?; Aplica em cabelo úmido ou seco?; Substitui a máscara?",
  },
  coloracao: {
    kw: "coloração profissional; tinta sem amônia; coloração permanente; emulsão oxidante 20/30/40 volumes",
    geoq: "qual coloração cobre 100% dos brancos?; diferença entre coloração com e sem amônia; qual volume de oxidante usar?; coloração permanente danifica o cabelo?",
    blocos: "cobertura de brancos como fato; tabela de volumes de oxidante compatíveis; tons disponíveis; FAQ técnico",
    schema: "Product + FAQPage",
    faq: "Cobre 100% dos cabelos brancos?; Precisa de oxidante? Qual volume?; Tem amônia?; Quantas aplicações rende?",
  },
  kit: {
    kw: "kit progressiva profissional; kit cronograma capilar; kit tratamento capilar completo",
    geoq: "qual kit comprar para fazer cronograma capilar?; o que vem no kit [X]?; kit capilar profissional vale a pena?",
    blocos: "lista factual do que vem no kit; para qual protocolo serve; ordem de uso (HowTo); economia vs. comprar avulso",
    schema: "Product + FAQPage + HowTo",
    faq: "O que vem no kit?; Para que serve cada item?; Qual a ordem de uso?; Quanto rende?",
  },
};
const CATS_VALIDAS = Object.keys(PLAYBOOK).join(", ");

const GEO_PRINCIPIOS = `PRINCÍPIOS GEO: 1) responder a pergunta direto e cedo (a IA extrai a 1ª frase que responde); 2) densidade factual (specs, números, pH, rendimento, duração — adjetivo solto não é citável); 3) clareza de entidade (nomear produto/marca/categoria/mecanismo igual em toda a página); 4) formato pergunta-resposta autônoma (o que a IA mais cita); 5) estrutura escaneável (definições curtas, tabelas, listas); 6) schema estruturado (Product, FAQPage, HowTo); 7) linguagem conversacional long-tail; 8) corroboração (dados idênticos em todos os canais); 9) frescor; 10) B2B reforça respaldo técnico e rendimento.
MODELO EM 3 CAMADAS: (1) venda — descrição curta e longa persuasivas/sensoriais (humano+SEO); (2) factual — dados citáveis estruturados (extração da IA); (3) FAQ — perguntas reais com respostas autônomas.`;

function parseJsonBlock(text: string): unknown {
  return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
}

async function getCtx(uid: string, ws: string, productId?: string) {
  return withUser(uid, async (cl) => {
    const w = (await cl.query("select settings from workspace where id=$1", [ws])).rows[0];
    const inUse = (w?.settings?.dna_in_use) || "atual";
    const dna = (await cl.query("select marca, posicionamento, tom, publico, provas, objecoes, evitar from brand_dna where workspace_id=$1 and kind=$2", [ws, inUse])).rows[0] || {};
    const product = productId ? (await cl.query("select name, description, short_description, categories from product where id=$1 and workspace_id=$2", [productId, ws])).rows[0] : null;
    return { dna, product };
  });
}

// Gera uma ficha de produto otimizada para SEO + GEO, em camadas.
r.post("/workspaces/:id/describe-seo", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const b = await c.req.json<{ productId?: string; brief?: string; productCategory?: string; segmento?: string }>();
  const cat = (b.productCategory || "").toLowerCase();
  const pb = PLAYBOOK[cat];
  if (!pb) return c.json({ error: `productCategory inválida. Use uma de: ${CATS_VALIDAS}` }, 400);

  let ctx: Awaited<ReturnType<typeof getCtx>>;
  try { ctx = await getCtx(uid, ws, b.productId); }
  catch (e) { return c.json({ error: "falha ao carregar contexto", detail: String(e) }, 500); }
  const alvo = b.brief || ctx.product?.name || "o produto";

  const prompt =
    `Você é redator de e-commerce de beleza, especialista em SEO e GEO (otimização para motores de resposta por IA). ` +
    `Escreva a FICHA do produto abaixo otimizada para os dois canais, em PT-BR, com a voz da marca. ` +
    `Densidade factual sem inventar specs que não existam (se não houver, deixe placeholders claros como "[rendimento]").\n\n` +
    GEO_PRINCIPIOS +
    `\n\nCATEGORIA: ${cat}\nKeywords-alvo: ${pb.kw}\nPerguntas que o público faz à IA: ${pb.geoq}\nBlocos que vencem: ${pb.blocos}\nSchema: ${pb.schema}\nFAQ sugerida: ${pb.faq}\n\n` +
    `DNA DA MARCA: ${JSON.stringify(ctx.dna)}\n` +
    (ctx.product ? `PRODUTO: ${JSON.stringify({ name: ctx.product.name, desc: ctx.product.description || ctx.product.short_description })}\n` : "") +
    `BRIEF/PRODUTO A DESCREVER: ${alvo}\nSegmento: ${b.segmento || "B2C"}\n\n` +
    `Responda APENAS em JSON válido:\n` +
    `{"descricao_curta":"","descricao_longa":"(abre com definicao/resposta direta, depois venda sensorial, depois reason-why factual)","seo":{"focus_keyword":"","meta_title":"(~55-60c)","meta_description":"(~150-160c)","slug":"","headings":["H1","H2..."],"alt_text":""},"geo":{"definicao":"1-2 frases extraíveis","resposta_direta":"resposta factual ao concern principal, autônoma","dados_citaveis":["fatos concretos: rendimento, pH, duração, composição"],"faq_geo":[{"pergunta":"como o público pergunta à IA","resposta":"autônoma e factual"}],"queries_alvo":["perguntas long-tail"]},"schema_sugerido":["Product","FAQPage"],"checklist_ok":["itens do checklist atendidos"],"avisos":["specs faltantes/placeholders a preencher"]}`;

  let parsed: unknown;
  try {
    const out = await callClaude(prompt, 2200);
    parsed = parseJsonBlock(out.text);
    await withUser(uid, (cl) => cl.query(
      `insert into generation(workspace_id, model, prompt, output, prompt_tokens, output_tokens, created_by) values($1,$2,$3,$4,$5,$6,$7)`,
      [ws, process.env.CLAUDE_MODEL || "claude-sonnet-4-6", JSON.stringify({ kind: "describe-seo", category: cat }), out.text, out.usage.input, out.usage.output, uid]
    )).catch(() => {});
  } catch (e) {
    return c.json({ error: "falha ao gerar a ficha", detail: String(e) }, 502);
  }
  return c.json(parsed);
});

// Revisa uma descrição existente contra o checklist SEO+GEO da categoria.
r.post("/workspaces/:id/review-description", async (c) => {
  const uid = c.get("userId"); const ws = c.req.param("id");
  const b = await c.req.json<{ content?: string; productCategory?: string }>();
  if (!b.content) return c.json({ error: "content obrigatório" }, 400);
  const cat = (b.productCategory || "").toLowerCase();
  const pb = PLAYBOOK[cat];

  let ctx: Awaited<ReturnType<typeof getCtx>>;
  try { ctx = await getCtx(uid, ws); }
  catch (e) { return c.json({ error: "falha ao carregar contexto", detail: String(e) }, 500); }
  const prompt =
    `Você é auditor sênior de SEO + GEO para e-commerce de beleza. Avalie a DESCRIÇÃO abaixo e produza uma revisão acionável em PT-BR.\n\n` +
    GEO_PRINCIPIOS +
    (pb ? `\n\nPLAYBOOK DA CATEGORIA (${cat}): keywords [${pb.kw}] · perguntas IA [${pb.geoq}] · blocos que vencem [${pb.blocos}] · FAQ [${pb.faq}]` : "") +
    `\n\nDNA DA MARCA: ${JSON.stringify(ctx.dna)}\n\nDESCRIÇÃO A REVISAR:\n${(b.content || "").slice(0, 6000)}\n\n` +
    `Responda APENAS em JSON válido:\n` +
    `{"score":<0-100>,"faixa":"competitivo|bom|fraco|critico","camadas":{"venda":"presente|parcial|ausente","factual":"presente|parcial|ausente","faq":"presente|parcial|ausente"},"checklist":[{"item":"","ok":true,"obs":"como corrigir se faltar"}],"lacunas":["o que falta para SEO/GEO"],"correcoes":["acoes concretas, priorizadas"],"resumo":"leitura geral"}`;

  let parsed: unknown;
  try {
    const out = await callClaude(prompt, 1800);
    parsed = parseJsonBlock(out.text);
    await withUser(uid, (cl) => cl.query(
      `insert into generation(workspace_id, model, prompt, output, prompt_tokens, output_tokens, created_by) values($1,$2,$3,$4,$5,$6,$7)`,
      [ws, process.env.CLAUDE_MODEL || "claude-sonnet-4-6", JSON.stringify({ kind: "review-description", category: cat }), out.text, out.usage.input, out.usage.output, uid]
    )).catch(() => {});
  } catch (e) {
    return c.json({ error: "falha ao revisar", detail: String(e) }, 502);
  }
  return c.json(parsed);
});

export default r;
