import 'server-only'

import { apiFetch } from '@/lib/api-client'

import type {
  CampaignDetail,
  CampaignListItem,
  Category,
  CopyDetail,
  CopyListItem,
  CopyVersion,
  ConnectorState,
  DnaBundle,
  Framework,
  Overview,
  PieceType,
  ProductListItem,
  Style,
} from './types'

// Funções de leitura server-only. Chamadas direto em Server Components
// (páginas). apiFetch já injeta o Bearer da sessão Better Auth.

const ws = (slug: string) => `/api/v1/workspaces/${encodeURIComponent(slug)}`

// --- Bibliotecas globais (cacheáveis; mudam raramente) ---
export async function getStyles() {
  return (await apiFetch<{ styles: Style[] }>('/api/v1/styles')).styles
}
export async function getFrameworks() {
  return (await apiFetch<{ frameworks: Framework[] }>('/api/v1/frameworks')).frameworks
}
export async function getPieceTypes() {
  return (await apiFetch<{ piece_types: PieceType[] }>('/api/v1/piece-types')).piece_types
}
export async function getCategories() {
  return (await apiFetch<{ categories: Category[] }>('/api/v1/categories')).categories
}

// --- Workspace ---
export async function getOverview(slug: string) {
  return apiFetch<Overview>(`${ws(slug)}/overview`)
}

export async function listWorkspaces() {
  return (await apiFetch<{ workspaces: { id: string; slug: string; name: string; plan: string }[] }>('/api/v1/workspaces')).workspaces
}

// --- DNA ---
export async function getDna(slug: string) {
  return apiFetch<DnaBundle>(`${ws(slug)}/dna`)
}

// --- Copies ---
export async function listCopies(slug: string, query?: { status?: string; campaign_id?: string; product_id?: string }) {
  const qs = new URLSearchParams()
  if (query?.status) qs.set('status', query.status)
  if (query?.campaign_id) qs.set('campaign_id', query.campaign_id)
  if (query?.product_id) qs.set('product_id', query.product_id)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return (await apiFetch<{ copies: CopyListItem[] }>(`${ws(slug)}/copies${suffix}`)).copies
}
export async function getCopy(slug: string, id: string) {
  return apiFetch<CopyDetail>(`${ws(slug)}/copies/${id}`)
}
export async function getCopyVersions(slug: string, id: string) {
  return (await apiFetch<{ versions: CopyVersion[] }>(`${ws(slug)}/copies/${id}/versions`)).versions
}

// --- Campaigns ---
export async function listCampaigns(slug: string) {
  return (await apiFetch<{ campaigns: CampaignListItem[] }>(`${ws(slug)}/campaigns`)).campaigns
}
export async function getCampaign(slug: string, id: string) {
  return apiFetch<{ campaign: CampaignDetail; copies: { id: string; title: string; status: string; piece_type_key: string | null; updated_at: string }[] }>(
    `${ws(slug)}/campaigns/${id}`,
  )
}

// --- Products ---
export async function listProducts(slug: string, query?: { q?: string; source?: string }) {
  const qs = new URLSearchParams()
  if (query?.q) qs.set('q', query.q)
  if (query?.source) qs.set('source', query.source)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<{ products: ProductListItem[]; total: number }>(`${ws(slug)}/products${suffix}`)
}

// --- Integrations ---
export async function listIntegrations(slug: string) {
  return apiFetch<{ connectors: ConnectorState[]; products_count: number }>(`${ws(slug)}/integrations`)
}
