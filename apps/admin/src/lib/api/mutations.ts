'use server'

import { revalidatePath } from 'next/cache'

import { ApiError, apiFetch } from '@/lib/api-client'

import type {
  Account,
  ActionResult,
  CampaignDetail,
  CopyDetail,
  Dna,
  GenerateResult,
  PageAudit,
  ProductDetail,
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
