import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

import type { BlogPostList, BlogPostRecord } from '@/lib/api/types'

// As server actions são módulos 'use server' que falam com o Rails — dubladas
// aqui. O que este teste prova é a regra da tela: quem pode ser editado, quem
// só pode ser visto, e que publicar recarrega a lista.
const listBlogPosts = vi.fn()
const getBlogPost = vi.fn()
const publishBlogDraft = vi.fn()
const deleteBlogPost = vi.fn()
const syncBlogPosts = vi.fn()

vi.mock('@/lib/api/mutations', () => ({
  listBlogPosts: (...args: unknown[]) => listBlogPosts(...args),
  getBlogPost: (...args: unknown[]) => getBlogPost(...args),
  publishBlogDraft: (...args: unknown[]) => publishBlogDraft(...args),
  deleteBlogPost: (...args: unknown[]) => deleteBlogPost(...args),
  syncBlogPosts: (...args: unknown[]) => syncBlogPosts(...args),
}))

// next-intl exige provider; a chave crua já identifica o elemento no teste.
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const { PostsClient } = await import('../posts-client')

function post(overrides: Partial<BlogPostRecord> = {}): BlogPostRecord {
  return {
    id: 'p1',
    origin: 'univercopy',
    title: 'Rascunho gerado',
    excerpt: null,
    status: 'draft',
    wp_status: null,
    wp_post_id: null,
    url: null,
    slug: null,
    featured_media_url: null,
    editable: true,
    last_error: null,
    published_at: null,
    updated_at: '2026-08-14T10:00:00Z',
    ...overrides,
  }
}

function payload(posts: BlogPostRecord[]): BlogPostList {
  return {
    posts,
    counts: {
      total: posts.length,
      drafts: posts.filter((p) => p.status === 'draft').length,
      univercopy: posts.filter((p) => p.origin === 'univercopy').length,
      wordpress: posts.filter((p) => p.origin === 'wordpress').length,
    },
    last_sync_at: null,
  }
}

describe('PostsClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listBlogPosts.mockResolvedValue({ ok: true, data: payload([post()]) })
  })

  it('lista os posts do acervo', async () => {
    render(<PostsClient slug="ws" onEdit={vi.fn()} />)
    expect(await screen.findByText('Rascunho gerado')).toBeTruthy()
  })

  it('oferece editar e publicar para rascunho nascido no UniverCopy', async () => {
    render(<PostsClient slug="ws" onEdit={vi.fn()} />)

    expect(await screen.findByText('posts_action_edit')).toBeTruthy()
    expect(screen.getByText('posts_action_publish')).toBeTruthy()
    expect(screen.queryByText('posts_action_view')).toBeNull()
  })

  it('post vindo do WordPress não expõe editar nem publicar — só o link do site', async () => {
    listBlogPosts.mockResolvedValue({
      ok: true,
      data: payload([
        post({
          id: 'wp1', origin: 'wordpress', status: 'published', editable: false,
          wp_post_id: 42, url: 'https://blog.test/post', title: 'Post do blog',
        }),
      ]),
    })

    render(<PostsClient slug="ws" onEdit={vi.fn()} />)

    expect(await screen.findByText('posts_action_view')).toBeTruthy()
    expect(screen.queryByText('posts_action_edit')).toBeNull()
    expect(screen.queryByText('posts_action_publish')).toBeNull()
  })

  it('abrir um rascunho carrega o detalhe e devolve pro editor', async () => {
    const onEdit = vi.fn()
    const detail = { ...post(), content: '<p>corpo</p>', brief: null, category_ids: [], tag_ids: [], featured_media_id: null, synced_at: null, wp_modified_at: null }
    getBlogPost.mockResolvedValue({ ok: true, data: detail })

    render(<PostsClient slug="ws" onEdit={onEdit} />)
    fireEvent.click(await screen.findByText('posts_action_edit'))

    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(detail))
    expect(getBlogPost).toHaveBeenCalledWith('ws', 'p1')
  })

  it('publicar manda status publish e recarrega a lista', async () => {
    publishBlogDraft.mockResolvedValue({ ok: true, data: post({ status: 'published' }) })

    render(<PostsClient slug="ws" onEdit={vi.fn()} />)
    fireEvent.click(await screen.findByText('posts_action_publish'))

    await waitFor(() => expect(publishBlogDraft).toHaveBeenCalledWith('ws', 'p1', 'publish'))
    // 1ª chamada no mount, 2ª depois de publicar.
    await waitFor(() => expect(listBlogPosts.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  it('enviar como rascunho manda status draft', async () => {
    publishBlogDraft.mockResolvedValue({ ok: true, data: post() })

    render(<PostsClient slug="ws" onEdit={vi.fn()} />)
    fireEvent.click(await screen.findByText('posts_action_send_draft'))

    await waitFor(() => expect(publishBlogDraft).toHaveBeenCalledWith('ws', 'p1', 'draft'))
  })

  it('mostra o erro da última tentativa de publicação', async () => {
    listBlogPosts.mockResolvedValue({
      ok: true,
      data: payload([post({ last_error: 'credenciais recusadas (401)' })]),
    })

    render(<PostsClient slug="ws" onEdit={vi.fn()} />)
    expect(await screen.findByText('credenciais recusadas (401)')).toBeTruthy()
  })

  it('erro da API vira mensagem na tela em vez de lista vazia silenciosa', async () => {
    listBlogPosts.mockResolvedValue({ ok: false, error: 'blog_not_connected', message: 'Nenhum WordPress conectado' })

    render(<PostsClient slug="ws" onEdit={vi.fn()} />)
    expect(await screen.findByText('Nenhum WordPress conectado')).toBeTruthy()
  })

  it('filtrar por WordPress refaz a busca com a origem', async () => {
    render(<PostsClient slug="ws" onEdit={vi.fn()} />)
    fireEvent.click(await screen.findByText('posts_filter_wordpress'))

    await waitFor(() =>
      expect(listBlogPosts).toHaveBeenLastCalledWith('ws', expect.objectContaining({ origin: 'wordpress' })),
    )
  })

  it('sincronizar enfileira e avisa', async () => {
    syncBlogPosts.mockResolvedValue({ ok: true, data: { ok: true, sync: 'queued' } })

    render(<PostsClient slug="ws" onEdit={vi.fn()} />)
    fireEvent.click(await screen.findByText('posts_sync'))

    await waitFor(() => expect(syncBlogPosts).toHaveBeenCalledWith('ws'))
    expect(await screen.findByText('posts_sync_queued')).toBeTruthy()
  })
})
