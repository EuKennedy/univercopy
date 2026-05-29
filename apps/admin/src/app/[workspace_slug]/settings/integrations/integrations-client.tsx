'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import { connectWoo, disconnectConnector, syncConnector, testWoo } from '@/lib/api/mutations'
import type { ConnectorState } from '@/lib/api/types'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  connected:    { label: 'Conectado',     cls: 'bg-emerald-500/15 text-emerald-300' },
  disconnected: { label: 'Desconectado',  cls: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-muted)]' },
  error:        { label: 'Erro',          cls: 'bg-[var(--uc-danger)]/15 text-[var(--uc-danger)]' },
}

export function IntegrationsClient({
  slug, connectors, productsCount,
}: {
  slug: string
  connectors: ConnectorState[]
  productsCount: number
}) {
  const woo = connectors.find((c) => c.type === 'woocommerce')

  return (
    <div className="space-y-4">
      {woo && <WooCard slug={slug} state={woo} productsCount={productsCount} />}

      {connectors
        .filter((c) => c.type !== 'woocommerce')
        .map((c) => <OtherCard key={c.type} state={c} />)}
    </div>
  )
}

function WooCard({ slug, state, productsCount }: { slug: string; state: ConnectorState; productsCount: number }) {
  const router = useRouter()
  const connected = state.status === 'connected'
  const [open, setOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [ck, setCk] = useState('')
  const [cs, setCs] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'paywall'; text: string } | null>(null)

  const meta = STATUS_META[state.status] ?? { label: state.status, cls: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-muted)]' }

  async function test() {
    setBusy('test'); setMsg(null)
    const res = await testWoo(slug, { base_url: baseUrl.trim(), consumer_key: ck.trim(), consumer_secret: cs.trim() })
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: `Conexão OK — ${res.data.total} produtos encontrados.` })
  }

  async function connect() {
    setBusy('connect'); setMsg(null)
    const res = await connectWoo(slug, { base_url: baseUrl.trim(), consumer_key: ck.trim(), consumer_secret: cs.trim() })
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: 'Loja conectada. Sincronização do catálogo iniciada.' })
    setOpen(false); setCk(''); setCs('')
    router.refresh()
  }

  async function sync() {
    setBusy('sync'); setMsg(null)
    const res = await syncConnector(slug, 'woocommerce')
    setBusy(null)
    setMsg(res.ok ? { kind: 'ok', text: 'Sincronização enfileirada.' } : { kind: 'err', text: res.message })
  }

  async function disconnect() {
    if (!confirm('Desconectar a loja? As credenciais serão removidas. Os produtos já importados continuam.')) return
    setBusy('disconnect')
    const res = await disconnectConnector(slug, 'woocommerce')
    setBusy(null)
    if (res.ok) router.refresh()
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex flex-wrap items-start gap-5 justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className="size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-[0_8px_22px_-8px_var(--uc-accent-glow)]" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
            <Icon name="product" size={22} />
          </span>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold tracking-tight text-[var(--uc-text)]">WooCommerce</h3>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>
            </div>
            <p className="text-sm leading-6 text-[var(--uc-text-soft)] max-w-xl">
              API REST v3 (BasicAuth com consumer key/secret). Sincroniza o catálogo pra gerar descrições em lote.
            </p>
            {connected && (
              <p className="text-xs text-[var(--uc-text-muted)]">
                {productsCount} produtos · {state.last_sync_at ? `último sync ${new Date(state.last_sync_at).toLocaleString('pt-BR')}` : 'sync pendente'}
              </p>
            )}
            {state.last_error && <p className="text-xs text-[var(--uc-danger)]">{state.last_error}</p>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {connected ? (
            <>
              <GlassButton size="sm" variant="secondary" loading={busy === 'sync'} onClick={sync}>Sincronizar</GlassButton>
              <GlassButton size="sm" variant="ghost" loading={busy === 'disconnect'} onClick={disconnect}>Desconectar</GlassButton>
            </>
          ) : state.allowed ? (
            <GlassButton size="sm" onClick={() => setOpen((v) => !v)}>{open ? 'Fechar' : 'Conectar'}</GlassButton>
          ) : (
            <span className="text-xs text-[var(--uc-text-muted)] self-center">Fora do seu plano</span>
          )}
        </div>
      </div>

      {open && !connected && (
        <div className="space-y-3 border-t border-[var(--uc-border)] pt-4">
          <GlassInput label="URL da loja" placeholder="https://sualoja.com.br" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <GlassInput label="Consumer Key" placeholder="ck_..." value={ck} onChange={(e) => setCk(e.target.value)} />
          <GlassInput label="Consumer Secret" placeholder="cs_..." type="password" value={cs} onChange={(e) => setCs(e.target.value)} />
          <p className="text-xs text-[var(--uc-text-muted)] leading-5">
            Gere as chaves em WooCommerce → Configurações → Avançado → REST API (permissão de leitura). Credenciais cifradas em repouso.
          </p>
          <div className="flex gap-2">
            <GlassButton variant="secondary" loading={busy === 'test'} disabled={!baseUrl || !ck || !cs} onClick={test}>Testar conexão</GlassButton>
            <GlassButton loading={busy === 'connect'} disabled={!baseUrl || !ck || !cs} onClick={connect}>Conectar + sincronizar</GlassButton>
          </div>
        </div>
      )}

      {msg && (
        <p className={cn(
          'text-sm',
          msg.kind === 'ok' && 'text-emerald-400',
          msg.kind === 'err' && 'text-[var(--uc-danger)]',
          msg.kind === 'paywall' && 'text-[var(--uc-accent-strong)]',
        )}>
          {msg.text}
        </p>
      )}
    </GlassCard>
  )
}

function OtherCard({ state }: { state: ConnectorState }) {
  const soon = state.type !== 'csv_manual'
  return (
    <GlassCard className="p-6 flex flex-wrap items-center gap-5 justify-between opacity-80">
      <div className="flex items-start gap-4 min-w-0">
        <span className="size-12 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
          <Icon name="product" size={22} />
        </span>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--uc-text)]">{state.label}</h3>
            <span className="text-[10px] font-bold tracking-wider uppercase rounded-full px-2 py-0.5 bg-[var(--uc-surface-2)] text-[var(--uc-text-muted)] border border-[var(--uc-border)]">
              {soon ? 'em breve' : 'em breve'}
            </span>
          </div>
          <p className="text-sm text-[var(--uc-text-soft)]">Disponível numa próxima versão.</p>
        </div>
      </div>
      <button type="button" disabled className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-[var(--uc-text-muted)] bg-[var(--uc-surface-2)] cursor-not-allowed opacity-60">
        Em breve
      </button>
    </GlassCard>
  )
}
