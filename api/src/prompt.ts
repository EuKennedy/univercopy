// Montagem do prompt em camadas (server-side) — porta da lógica do protótipo.
type Dna = {
  marca?: string; posicionamento?: string; tom?: string; publico?: string;
  consciencia?: string; provas?: string[]; objecoes?: string[]; evitar?: string[];
};
type Style = { name: string; era?: string; description?: string; principles?: string[] };
type Framework = { name: string; structure?: string };
type PieceType = { name: string; description?: string; structure?: string; length_hint?: string };

export type PromptInput = {
  dna: Dna;
  pieceType?: PieceType | null;
  style?: Style | null;
  framework?: Framework | null;
  brief: string;
  reference?: { title: string; source?: string; notes?: string } | null;
  product?: { name: string; description?: string } | null;
  reviews?: string[];
};

export function buildPrompt(i: PromptInput): { layers: [string, string][]; full: string } {
  const d = i.dna || {};
  const L: [string, string][] = [];
  if (i.pieceType)
    L.push(["Peça a criar",
      `# PEÇA A CRIAR — ${i.pieceType.name}\nO que é: ${i.pieceType.description || ""}\nEstrutura: ${i.pieceType.structure || ""}\nExtensão: ${i.pieceType.length_hint || ""}`]);
  L.push(["DNA da Marca",
    `# DNA DA MARCA (${d.marca || ""})\n- Posicionamento: ${d.posicionamento || ""}\n- Tom de voz: ${d.tom || ""}\n- Público: ${d.publico || ""}\n- Consciência: ${d.consciencia || ""}\n- Provas: ${(d.provas || []).join("; ")}\n- Objeções: ${(d.objecoes || []).join(" | ")}\n- NÃO usar: ${(d.evitar || []).join(", ")}`]);
  if (i.style)
    L.push(["Estilo",
      `# LENTE DO ESPECIALISTA — ${i.style.name} (${i.style.era || ""})\n${i.style.description || ""}\nPrincípios: ${(i.style.principles || []).join("; ")}.`]);
  if (i.framework)
    L.push(["Framework",
      `# FRAMEWORK — ${i.framework.name}\nEstruture nesta ordem: ${i.framework.structure || ""}.`]);
  if (i.reference)
    L.push(["Referência",
      `# REFERÊNCIA (inspiração de estrutura e ângulo — NÃO copiar)\n${i.reference.title} (${i.reference.source || ""}): ${i.reference.notes || ""}`]);
  if (i.reviews && i.reviews.length)
    L.push(["Voz do cliente",
      `# VOZ DO CLIENTE (avaliações reais)\n${i.reviews.slice(0, 8).map((r) => "- " + r).join("\n")}`]);
  const prod = i.product ? `\nProduto: ${i.product.name}. ${i.product.description || ""}` : "";
  L.push(["Tarefa",
    `# TAREFA\nEscreva a peça "${i.pieceType ? i.pieceType.name : "copy"}" sobre: ${i.brief}.${prod}\nGere 2 variações distintas em português do Brasil, separadas por uma linha com apenas "---".\nRespeite o tom da marca, trate ao menos uma objeção e evite as palavras proibidas. Sem preâmbulos — entregue só a copy.`]);
  return { layers: L, full: L.map((x) => x[1]).join("\n\n") };
}
