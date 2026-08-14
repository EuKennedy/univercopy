'use server'

import { revalidatePath } from 'next/cache'

import { ApiError, apiFetch } from '@/lib/api-client'

import type {
  Account,
  ActionResult,
  AgentJob,
  AgentMessage,
  AgentPlan,
  AgentReply,
  AiCostReport,
  BlogDraftInput,
  BlogMedia,
  BlogPostDetail,
  BlogPostList,
  BlogPostOrigin,
  BlogPostResult,
  BlogStatus,
  BlogTerm,
  CampaignDetail,
  CommunityCredentials,
  CommunityPublishResult,
  CommunitySpace,
  CommunityStatus,
  CopyDetail,
  Dna,
  GenerateResult,
  PageAudit,
  ProductDetail,
  SequenceResult,
  WordpressCredentials,
} from './types'

const ws = (slug: string) => `/api/v1/workspaces/${encodeURIComponent(slug)}`

// Normaliza qualquer erro do Rails (incl. 402 paywall/cap) num ActionResult
// que a UI client trata sem try/catch.
async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    if (err instanceof ApiError) {
      const body = (err.body ?? {}) as Record<string, unknown>
      return {
        ok: false,
        error: String(body.error ?? 'request_failed'),
        message: String(body.message ?? err.message),
        feature: body.feature as string | undefined,
        plan: body.plan as string | undefined,
      }
    }
    return { ok: false, error: 'unknown', message: err instanceof Error ? err.message : 'erro inesperado' }
  }
}

// ---------------- Gerador ----------------
export async function generateCopy(
  slug: string,
  input: {
    piece_type_key: string
    style_key?: string
    framework_key?: string
    product_id?: string
    campaign_id?: string
    brief?: string
    n?: number
    model?: string
  },
): Promise<ActionResult<GenerateResult>> {
  return run(() =>
    apiFetch<GenerateResult>(`${ws(slug)}/generate`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

// Salva uma variação escolhida como Copy no acervo.
export async function saveCopy(
  slug: string,
  input: {
    title: string
    content: string
    category_key?: string | null
    piece_type_key?: string | null
    style_key?: string | null
    framework_key?: string | null
    product_id?: string | null
    campaign_id?: string | null
    channel?: string | null
    tags?: string[]
  },
): Promise<ActionResult<CopyDetail>> {
  const result = await run(() =>
    apiFetch<CopyDetail>(`${ws(slug)}/copies`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/copy`)
  return result
}

// Gera uma sequência multi-canal e salva direto na campanha.
export async function generateSequence(
  slug: string,
  campaignId: string,
  input: {
    channel: string
    piece_type_key?: string
    style_key?: string
    framework_key?: string
    product_id?: string
    brief?: string
    steps?: number
    model?: string
  },
): Promise<ActionResult<SequenceResult>> {
  const result = await run(() =>
    apiFetch<SequenceResult>(`${ws(slug)}/campaigns/${campaignId}/sequence`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/campaigns/${campaignId}`)
  return result
}

// ---------------- Copies ----------------
export async function updateCopy(
  slug: string,
  id: string,
  patch: { title?: string; status?: string; tags?: string[] },
): Promise<ActionResult<CopyDetail>> {
  const result = await run(() =>
    apiFetch<CopyDetail>(`${ws(slug)}/copies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  )
  if (result.ok) {
    revalidatePath(`/${slug}/copy/${id}`)
    revalidatePath(`/${slug}/copy`)
  }
  return result
}

export async function createCopyVersion(
  slug: string,
  id: string,
  content: string,
  note?: string,
): Promise<ActionResult<unknown>> {
  const result = await run(() =>
    apiFetch(`${ws(slug)}/copies/${id}/versions`, {
      method: 'POST',
      body: JSON.stringify({ content, note }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/copy/${id}`)
  return result
}

export async function deleteCopy(slug: string, id: string): Promise<ActionResult<unknown>> {
  const result = await run(() =>
    apiFetch(`${ws(slug)}/copies/${id}`, { method: 'DELETE' }),
  )
  if (result.ok) revalidatePath(`/${slug}/copy`)
  return result
}

// ---------------- DNA ----------------
export async function saveDnaKind(
  slug: string,
  kind: 'atual' | 'proposto',
  dna: Partial<Dna>,
): Promise<ActionResult<Dna>> {
  const result = await run(() =>
    apiFetch<Dna>(`${ws(slug)}/dna/${kind}`, {
      method: 'PATCH',
      body: JSON.stringify({ dna }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/dna`)
  return result
}

export async function useDnaKind(
  slug: string,
  kind: 'atual' | 'proposto',
): Promise<ActionResult<{ ok: true; dna_in_use: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: true; dna_in_use: string }>(`${ws(slug)}/dna/use`, {
      method: 'POST',
      body: JSON.stringify({ kind }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/dna`)
  return result
}

export async function improveDna(
  slug: string,
  input: { framework?: string; direction?: string; model?: string },
): Promise<ActionResult<Dna>> {
  const result = await run(() =>
    apiFetch<Dna>(`${ws(slug)}/dna/improve`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/dna`)
  return result
}

// ---------------- Campaigns ----------------
export async function createCampaign(
  slug: string,
  input: { name: string; objective?: string; audience?: string; context?: string; starts_at?: string; ends_at?: string },
): Promise<ActionResult<CampaignDetail>> {
  const result = await run(() =>
    apiFetch<CampaignDetail>(`${ws(slug)}/campaigns`, {
      method: 'POST',
      body: JSON.stringify({ campaign: input }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/campaigns`)
  return result
}

export async function updateCampaign(
  slug: string,
  id: string,
  patch: Partial<{ name: string; objective: string; audience: string; status: string; context: string }>,
): Promise<ActionResult<CampaignDetail>> {
  const result = await run(() =>
    apiFetch<CampaignDetail>(`${ws(slug)}/campaigns/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ campaign: patch }),
    }),
  )
  if (result.ok) {
    revalidatePath(`/${slug}/campaigns/${id}`)
    revalidatePath(`/${slug}/campaigns`)
  }
  return result
}

// ---------------- Integrations / WooCommerce ----------------
// WordPress autentica com HTTP Basic (usuário + senha de aplicação). O Rails
// valida a credencial contra o site antes de cifrar e salvar.
export async function testWordpress(
  slug: string,
  creds: WordpressCredentials,
): Promise<ActionResult<{ ok: boolean; total: number; site: string }>> {
  return run(() =>
    apiFetch<{ ok: boolean; total: number; site: string }>(`${ws(slug)}/integrations/wordpress/test`, {
      method: 'POST',
      body: JSON.stringify({ wordpress: creds }),
    }),
  )
}

export async function connectWordpress(
  slug: string,
  creds: WordpressCredentials,
): Promise<ActionResult<{ ok: boolean; type: string; status: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: boolean; type: string; status: string }>(`${ws(slug)}/integrations/wordpress`, {
      method: 'POST',
      body: JSON.stringify({ wordpress: creds }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/integrations`)
  return result
}

// Troca só o modelo de texto. Separado do connect porque a chave nunca volta
// pro cliente — pedir reenvio dela a cada ajuste seria hostil.
export async function updateOpenaiModel(
  slug: string,
  text_model: string,
): Promise<ActionResult<{ ok: boolean; text_model: string; text_provider: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: boolean; text_model: string; text_provider: string }>(`${ws(slug)}/integrations/openai`, {
      method: 'PATCH',
      body: JSON.stringify({ openai: { text_model } }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/integrations`)
  return result
}

export async function testWoo(
  slug: string,
  creds: { base_url: string; consumer_key: string; consumer_secret: string },
): Promise<ActionResult<{ ok: boolean; total: number }>> {
  return run(() =>
    apiFetch<{ ok: boolean; total: number }>(`${ws(slug)}/integrations/woocommerce/test`, {
      method: 'POST',
      body: JSON.stringify({ woocommerce: creds }),
    }),
  )
}

export async function connectWoo(
  slug: string,
  creds: { base_url: string; consumer_key: string; consumer_secret: string },
): Promise<ActionResult<{ ok: boolean; status: string; sync: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: boolean; status: string; sync: string }>(`${ws(slug)}/integrations/woocommerce`, {
      method: 'POST',
      body: JSON.stringify({ woocommerce: creds }),
    }),
  )
  if (result.ok) {
    revalidatePath(`/${slug}/settings/integrations`)
    revalidatePath(`/${slug}/products`)
  }
  return result
}

export async function syncConnector(slug: string, type: string): Promise<ActionResult<{ ok: boolean; sync: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: boolean; sync: string }>(`${ws(slug)}/integrations/${type}/sync`, { method: 'POST' }),
  )
  if (result.ok) revalidatePath(`/${slug}/products`)
  return result
}

export async function disconnectConnector(slug: string, type: string): Promise<ActionResult<{ ok: boolean; status: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: boolean; status: string }>(`${ws(slug)}/integrations/${type}`, { method: 'DELETE' }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/integrations`)
  return result
}

// ---------------- Conta (preferências) ----------------
export async function updateAccount(
  slug: string,
  patch: { default_locale?: string; preferred_ai_model?: string },
): Promise<ActionResult<Account>> {
  const result = await run(() =>
    apiFetch<Account>('/api/v1/me', { method: 'PATCH', body: JSON.stringify(patch) }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/preferences`)
  return result
}

// ---------------- Produto: write-back + IA por campo ----------------
export async function publishProduct(
  slug: string,
  id: string,
  payload: Record<string, unknown>,
): Promise<ActionResult<ProductDetail>> {
  const result = await run(() =>
    apiFetch<ProductDetail>(`${ws(slug)}/products/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/products/${id}`)
  return result
}

export async function generateProductField(
  slug: string,
  id: string,
  field: string,
  instruction?: string,
): Promise<ActionResult<{ field: string; kind: string; value: unknown }>> {
  return run(() =>
    apiFetch<{ field: string; kind: string; value: unknown }>(`${ws(slug)}/products/${id}/generate-field`, {
      method: 'POST',
      body: JSON.stringify({ field, instruction }),
    }),
  )
}

// ---------------- Análise de página ----------------
export async function runPageAudit(
  slug: string,
  input: { url: string; model?: string },
): Promise<ActionResult<PageAudit>> {
  const result = await run(() =>
    apiFetch<PageAudit>(`${ws(slug)}/page-audits`, { method: 'POST', body: JSON.stringify(input) }),
  )
  if (result.ok) revalidatePath(`/${slug}/audit`)
  return result
}

// ---------------- Blog WordPress ----------------
// Leituras também vivem aqui (e não em queries.ts) porque o client component
// as chama depois da montagem: são round-trips pra um WordPress externo, e
// bloquear o Server Component neles deixaria a página no branco. O formulário
// abre na hora e preenche depois.
export async function loadBlogStatus(slug: string): Promise<ActionResult<BlogStatus>> {
  return run(() => apiFetch<BlogStatus>(`${ws(slug)}/blog/status`))
}

export async function loadBlogCategories(slug: string): Promise<ActionResult<BlogTerm[]>> {
  return run(async () =>
    (await apiFetch<{ categories: BlogTerm[] }>(`${ws(slug)}/blog/categories`)).categories,
  )
}

export async function loadBlogTags(slug: string): Promise<ActionResult<BlogTerm[]>> {
  return run(async () => (await apiFetch<{ tags: BlogTerm[] }>(`${ws(slug)}/blog/tags`)).tags)
}

// Botão "+" da tela. O Rails reaproveita o termo se o WordPress disser que já
// existe, então isso é idempotente do ponto de vista de quem clicou.
export async function createBlogCategory(slug: string, name: string): Promise<ActionResult<BlogTerm>> {
  return run(async () =>
    (
      await apiFetch<{ term: BlogTerm }>(`${ws(slug)}/blog/categories`, {
        method: 'POST',
        body: JSON.stringify({ term: { name } }),
      })
    ).term,
  )
}

export async function createBlogTag(slug: string, name: string): Promise<ActionResult<BlogTerm>> {
  return run(async () =>
    (
      await apiFetch<{ term: BlogTerm }>(`${ws(slug)}/blog/tags`, {
        method: 'POST',
        body: JSON.stringify({ term: { name } }),
      })
    ).term,
  )
}

// --- Geração com IA ---

export async function generateBlogTitle(
  slug: string,
  input: { brief?: string; model?: string },
): Promise<ActionResult<{ title: string; cost: AiCostReport }>> {
  return run(() =>
    apiFetch<{ title: string; cost: AiCostReport }>(`${ws(slug)}/blog/generate/title`, {
      method: 'POST',
      body: JSON.stringify({ generate: input }),
    }),
  )
}

export async function generateBlogContent(
  slug: string,
  input: { title?: string; brief?: string; model?: string },
): Promise<ActionResult<{ content: string; cost: AiCostReport }>> {
  return run(() =>
    apiFetch<{ content: string; cost: AiCostReport }>(`${ws(slug)}/blog/generate/content`, {
      method: 'POST',
      body: JSON.stringify({ generate: input }),
    }),
  )
}

// Gera na OpenAI e já sobe pro WordPress — volta só a URL, não a imagem.
export async function generateBlogCover(
  slug: string,
  input: { title?: string; brief?: string; prompt?: string; size?: string; quality?: string },
): Promise<ActionResult<{ media: BlogMedia; prompt: string; cost: AiCostReport }>> {
  return run(() =>
    apiFetch<{ media: BlogMedia; prompt: string; cost: AiCostReport }>(`${ws(slug)}/blog/cover/generate`, {
      method: 'POST',
      body: JSON.stringify({ cover: input }),
    }),
  )
}

export async function uploadBlogCover(
  slug: string,
  input: { filename: string; mime: string; data_base64: string; alt?: string },
): Promise<ActionResult<{ media: BlogMedia }>> {
  return run(() =>
    apiFetch<{ media: BlogMedia }>(`${ws(slug)}/blog/cover/upload`, {
      method: 'POST',
      body: JSON.stringify({ cover: input }),
    }),
  )
}

export async function publishBlogPost(
  slug: string,
  input: {
    title: string
    content: string
    excerpt?: string
    status: 'draft' | 'publish'
    category_ids?: number[]
    tag_ids?: number[]
    featured_media?: number
  },
): Promise<ActionResult<BlogPostResult>> {
  return run(async () =>
    (
      await apiFetch<{ ok: boolean; post: BlogPostResult }>(`${ws(slug)}/blog/publish`, {
        method: 'POST',
        body: JSON.stringify({ post: input }),
      })
    ).post,
  )
}

// --- Acervo local de posts ("Meus posts") ---
// Junta o que o sync trouxe do WordPress com o que foi gerado aqui. Rascunho
// local só vira post no WordPress quando publishBlogDraft é chamado.

export async function listBlogPosts(
  slug: string,
  query?: { origin?: BlogPostOrigin; status?: 'draft' | 'published'; q?: string },
): Promise<ActionResult<BlogPostList>> {
  const qs = new URLSearchParams()
  if (query?.origin) qs.set('origin', query.origin)
  if (query?.status) qs.set('status', query.status)
  if (query?.q) qs.set('q', query.q)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''

  return run(() => apiFetch<BlogPostList>(`${ws(slug)}/blog/posts${suffix}`))
}

export async function getBlogPost(slug: string, id: string): Promise<ActionResult<BlogPostDetail>> {
  return run(async () =>
    (await apiFetch<{ post: BlogPostDetail }>(`${ws(slug)}/blog/posts/${encodeURIComponent(id)}`)).post,
  )
}

export async function saveBlogDraft(
  slug: string,
  input: BlogDraftInput,
): Promise<ActionResult<BlogPostDetail>> {
  return run(async () =>
    (
      await apiFetch<{ post: BlogPostDetail }>(`${ws(slug)}/blog/posts`, {
        method: 'POST',
        body: JSON.stringify({ post: input }),
      })
    ).post,
  )
}

export async function updateBlogDraft(
  slug: string,
  id: string,
  input: BlogDraftInput,
): Promise<ActionResult<BlogPostDetail>> {
  return run(async () =>
    (
      await apiFetch<{ post: BlogPostDetail }>(`${ws(slug)}/blog/posts/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ post: input }),
      })
    ).post,
  )
}

export async function deleteBlogPost(slug: string, id: string): Promise<ActionResult<{ ok: boolean }>> {
  return run(() =>
    apiFetch<{ ok: boolean }>(`${ws(slug)}/blog/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  )
}

export async function publishBlogDraft(
  slug: string,
  id: string,
  status: 'draft' | 'publish',
): Promise<ActionResult<BlogPostDetail>> {
  return run(async () =>
    (
      await apiFetch<{ ok: boolean; post: BlogPostDetail }>(
        `${ws(slug)}/blog/posts/${encodeURIComponent(id)}/publish`,
        { method: 'POST', body: JSON.stringify({ status }) },
      )
    ).post,
  )
}

// Re-importa o blog do WordPress. Enfileira e volta na hora — a lista se
// atualiza no próximo carregamento.
export async function syncBlogPosts(slug: string): Promise<ActionResult<{ ok: boolean; sync: string }>> {
  return run(() =>
    apiFetch<{ ok: boolean; sync: string }>(`${ws(slug)}/blog/sync`, { method: 'POST' }),
  )
}

// --- Fluent Community ---
// O que vai pro feed é uma chamada curta em markdown COM link pro artigo, não
// o post do blog republicado: o feed não renderiza HTML e tem teto de 15k.

export async function loadCommunityStatus(slug: string): Promise<ActionResult<CommunityStatus>> {
  return run(() => apiFetch<CommunityStatus>(`${ws(slug)}/community/status`))
}

export async function loadCommunitySpaces(slug: string): Promise<ActionResult<CommunitySpace[]>> {
  return run(async () =>
    (await apiFetch<{ spaces: CommunitySpace[] }>(`${ws(slug)}/community/spaces`)).spaces,
  )
}

// Gera o texto sem publicar — o usuário lê e ajusta antes de ir pro feed.
export async function generateCommunityMessage(
  slug: string,
  postId: string,
): Promise<ActionResult<{ message: string; cost: AiCostReport }>> {
  return run(() =>
    apiFetch<{ message: string; cost: AiCostReport }>(
      `${ws(slug)}/community/posts/${encodeURIComponent(postId)}/message`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  )
}

export async function publishToCommunity(
  slug: string,
  postId: string,
  input: { message: string; space: string; title?: string },
): Promise<ActionResult<CommunityPublishResult>> {
  return run(async () =>
    (
      await apiFetch<{ ok: boolean; community: CommunityPublishResult }>(
        `${ws(slug)}/community/posts/${encodeURIComponent(postId)}/publish`,
        { method: 'POST', body: JSON.stringify({ community: input }) },
      )
    ).community,
  )
}

export async function testCommunity(
  slug: string,
  input: CommunityCredentials,
): Promise<ActionResult<{ ok: boolean; site?: string; spaces?: number }>> {
  return run(() =>
    apiFetch<{ ok: boolean; site?: string; spaces?: number }>(`${ws(slug)}/integrations/fluent_community/test`, {
      method: 'POST',
      body: JSON.stringify({ fluent_community: input }),
    }),
  )
}

export async function connectCommunity(
  slug: string,
  input: CommunityCredentials,
): Promise<ActionResult<{ ok: boolean; type: string; status: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: boolean; type: string; status: string }>(`${ws(slug)}/integrations/fluent_community`, {
      method: 'POST',
      body: JSON.stringify({ fluent_community: input }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/integrations`)
  return result
}

// --- Agente de blog ---
// A conversa não tem estado no servidor: o cliente devolve o histórico a cada
// turno. `ready` só significa que o plano fechou — quem dispara a publicação é
// o clique do usuário em runBlogAgent, nunca o modelo.
export async function sendBlogAgentMessage(
  slug: string,
  messages: AgentMessage[],
): Promise<ActionResult<AgentReply>> {
  return run(() =>
    apiFetch<AgentReply>(`${ws(slug)}/blog/agent/message`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
  )
}

export async function runBlogAgent(slug: string, plan: AgentPlan): Promise<ActionResult<AgentJob>> {
  return run(async () =>
    (
      await apiFetch<{ job: AgentJob }>(`${ws(slug)}/blog/agent/run`, {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
    ).job,
  )
}

export async function getBlogAgentRun(slug: string, jobId: string): Promise<ActionResult<AgentJob>> {
  return run(async () =>
    (await apiFetch<{ job: AgentJob }>(`${ws(slug)}/blog/agent/run/${encodeURIComponent(jobId)}`)).job,
  )
}

// --- OpenAI (chave no painel, não em ENV) ---

export async function testOpenai(slug: string, api_key: string): Promise<ActionResult<{ ok: boolean }>> {
  return run(() =>
    apiFetch<{ ok: boolean }>(`${ws(slug)}/integrations/openai/test`, {
      method: 'POST',
      body: JSON.stringify({ openai: { api_key } }),
    }),
  )
}

// text_model vazio = OpenAI só para capa; o texto segue no Anthropic.
export async function connectOpenai(
  slug: string,
  input: { api_key: string; text_model: string },
): Promise<ActionResult<{ ok: boolean; type: string; status: string }>> {
  const result = await run(() =>
    apiFetch<{ ok: boolean; type: string; status: string }>(`${ws(slug)}/integrations/openai`, {
      method: 'POST',
      body: JSON.stringify({ openai: input }),
    }),
  )
  if (result.ok) revalidatePath(`/${slug}/settings/integrations`)
  return result
}
