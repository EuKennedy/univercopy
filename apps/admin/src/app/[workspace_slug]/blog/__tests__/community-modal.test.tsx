import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

import type { BlogPostRecord } from '@/lib/api/types'

const loadCommunityStatus = vi.fn()
const loadCommunitySpaces = vi.fn()
const generateCommunityMessage = vi.fn()
const publishToCommunity = vi.fn()

vi.mock('@/lib/api/mutations', () => ({
  loadCommunityStatus: (...a: unknown[]) => loadCommunityStatus(...a),
  loadCommunitySpaces: (...a: unknown[]) => loadCommunitySpaces(...a),
  generateCommunityMessage: (...a: unknown[]) => generateCommunityMessage(...a),
  publishToCommunity: (...a: unknown[]) => publishToCommunity(...a),
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const { CommunityModal } = await import('../community-modal')

const post: BlogPostRecord = {
  id: 'p1', origin: 'univercopy', title: 'Rotina de skincare', excerpt: null,
  status: 'published', wp_status: 'publish', wp_post_id: 10,
  url: 'https://blog.test/rotina', slug: 'rotina', featured_media_url: null,
  editable: false, last_error: null, published_at: '2026-08-14T10:00:00Z',
  updated_at: '2026-08-14T10:00:00Z', shareable: true,
  community_url: null, community_space: null,
}

describe('CommunityModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadCommunityStatus.mockResolvedValue({
      ok: true, data: { connected: true, reachable: true, default_space: 'start-here' },
    })
    loadCommunitySpaces.mockResolvedValue({
      ok: true,
      data: [
        { id: 2, title: 'Comece Aqui', slug: 'start-here', type: 'community', privacy: 'public' },
        { id: 7, title: 'Anúncios', slug: 'announcements', type: 'community', privacy: 'private' },
      ],
    })
    generateCommunityMessage.mockResolvedValue({ ok: true, data: { message: 'Chamada gerada pela IA', cost: {} } })
    publishToCommunity.mockResolvedValue({
      ok: true, data: { id: 900, url: 'https://comunidade.test/f/900', slug: 'f900', space: 'start-here' },
    })
  })

  it('gera a chamada sozinho ao abrir — o usuário não precisa pedir', async () => {
    render(<CommunityModal slug="ws" post={post} onClose={vi.fn()} onPublished={vi.fn()} />)

    await waitFor(() => expect(generateCommunityMessage).toHaveBeenCalledWith('ws', 'p1'))
    await waitFor(() =>
      expect((screen.getByLabelText('community_message') as HTMLTextAreaElement).value)
        .toBe('Chamada gerada pela IA'),
    )
  })

  it('lista os spaces e pré-seleciona o padrão da integração', async () => {
    render(<CommunityModal slug="ws" post={post} onClose={vi.fn()} onPublished={vi.fn()} />)

    await waitFor(() =>
      expect((screen.getByLabelText('community_space') as HTMLSelectElement).value).toBe('start-here'),
    )
    expect(await screen.findByText('Comece Aqui')).toBeTruthy()
  })

  it('publica com a mensagem e o space escolhidos e avisa quem chamou', async () => {
    const onPublished = vi.fn()
    render(<CommunityModal slug="ws" post={post} onClose={vi.fn()} onPublished={onPublished} />)

    await screen.findByText('community_publish')
    await waitFor(() =>
      expect((screen.getByLabelText('community_message') as HTMLTextAreaElement).value).not.toBe(''),
    )

    fireEvent.change(screen.getByLabelText('community_space'), { target: { value: 'announcements' } })
    fireEvent.click(screen.getByText('community_publish'))

    await waitFor(() =>
      expect(publishToCommunity).toHaveBeenCalledWith('ws', 'p1', {
        message: 'Chamada gerada pela IA',
        space: 'announcements',
      }),
    )
    await waitFor(() => expect(onPublished).toHaveBeenCalled())
  })

  it('bloqueia o botão acima do teto de 15k do plugin', async () => {
    generateCommunityMessage.mockResolvedValue({ ok: true, data: { message: 'x'.repeat(15_001), cost: {} } })
    render(<CommunityModal slug="ws" post={post} onClose={vi.fn()} onPublished={vi.fn()} />)

    await waitFor(() =>
      expect((screen.getByText('community_publish').closest('button') as HTMLButtonElement).disabled).toBe(true),
    )
    expect(publishToCommunity).not.toHaveBeenCalled()
  })

  it('sem comunidade conectada, manda pras integrações em vez de mostrar formulário', async () => {
    loadCommunityStatus.mockResolvedValue({ ok: true, data: { connected: false, reachable: false } })
    render(<CommunityModal slug="ws" post={post} onClose={vi.fn()} onPublished={vi.fn()} />)

    expect(await screen.findByText('community_not_connected')).toBeTruthy()
    expect(screen.queryByLabelText('community_message')).toBeNull()
  })

  it('erro da publicação aparece na tela e não fecha o modal', async () => {
    publishToCommunity.mockResolvedValue({
      ok: false, error: 'community_publish_failed', message: 'selecione ao menos um tópico',
    })
    const onPublished = vi.fn()
    render(<CommunityModal slug="ws" post={post} onClose={vi.fn()} onPublished={onPublished} />)

    await waitFor(() =>
      expect((screen.getByLabelText('community_message') as HTMLTextAreaElement).value).not.toBe(''),
    )
    fireEvent.click(screen.getByText('community_publish'))

    expect(await screen.findByText('selecione ao menos um tópico')).toBeTruthy()
    expect(onPublished).not.toHaveBeenCalled()
  })
})
