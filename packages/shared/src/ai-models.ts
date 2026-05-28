// Model routing — espelha apps/api/app/lib/ai/router.rb. Quando 'auto', o
// backend escolhe baseado em complexidade da task (ver README do router).

export type AiModelChoice = 'auto' | 'haiku' | 'sonnet' | 'opus'

export const AI_MODEL_LABELS: Record<AiModelChoice, string> = {
  auto: 'Auto (recomendado)',
  haiku: 'Claude Haiku — rápido & econômico',
  sonnet: 'Claude Sonnet — equilíbrio',
  opus: 'Claude Opus — máxima qualidade',
}

export const AI_MODEL_DESCRIPTIONS: Record<AiModelChoice, string> = {
  auto: 'Deixa o sistema escolher o modelo ideal pra cada tarefa.',
  haiku: 'Ideal pra operações em lote e tarefas simples. ~5x mais barato.',
  sonnet: 'Padrão para geração de copy, descrições e análises de qualidade.',
  opus: 'Reservado para tarefas de raciocínio complexo (Intelligence comparativa, análises profundas).',
}

// Tipo da operação que pede o roteamento. Usado pelo Auto Router pra escolher.
export type AiTaskKind =
  | 'bulk_generate'
  | 'import_from_url'
  | 'extract_dna_from_url'
  | 'generate_copy'
  | 'dna_improve'
  | 'name_generator'
  | 'seo_describe'
  | 'seo_review'
  | 'page_audit'
  | 'product_profile'
  | 'intelligence_ingest'
  | 'intelligence_compare'
  | 'rag_embed'
