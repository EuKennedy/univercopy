// Parser tolerante a JSON truncado. Modelos podem bater no max_tokens e
// devolver JSON cortado no meio; aqui tentamos reparar fechando strings,
// removendo vírgula/“chave sem valor” pendente e fechando { [ abertos.

function repairTruncatedJson(src: string): string {
  let out = "";
  let inStr = false, esc = false;
  const stack: string[] = [];
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    out += ch;
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inStr) out += '"';
  out = out.replace(/,\s*$/, "");       // vírgula final pendente
  out = out.replace(/:\s*$/, ":null");   // chave sem valor → null
  out = out.replace(/,\s*$/, "");
  while (stack.length) out += stack.pop();
  return out;
}

// Extrai e faz parse do primeiro objeto JSON de um texto, com reparo de truncamento.
export function parseJsonBlock<T = unknown>(text: string): T {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("nenhum objeto JSON encontrado na resposta");
  const raw = text.slice(start, text.lastIndexOf("}") + 1);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return JSON.parse(repairTruncatedJson(text.slice(start))) as T;
  }
}
