'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'
import { Icon } from '@/components/shell/icon'
import { cn } from '@/lib/cn'
import {
  connectOpenai,
  connectWoo,
  connectWordpress,
  disconnectConnector,
  syncConnector,
  testOpenai,
  testWoo,
  testWordpress,
} from '@/lib/api/mutations'
import type { ConnectorState } from '@/lib/api/types'

const STATUS_CLS: Record<string, string> = {
  connected:    'bg-emerald-500/15 text-emerald-300',
  disconnected: 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-muted)]',
  error:        'bg-[var(--uc-danger)]/15 text-[var(--uc-danger)]',
}

export function IntegrationsClient({
  slug, connectors, productsCount,
}: {
  slug: string
  connectors: ConnectorState[]
  productsCount: number
}) {
  const woo = connectors.find((c) => c.type === 'woocommerce')
  const wp = connectors.find((c) => c.type === 'wordpress')
  const openai = connectors.find((c) => c.type === 'openai')

  return (
    <div className="space-y-4">
      {woo && <WooCard slug={slug} state={woo} productsCount={productsCount} />}
      {wp && <WordpressCard slug={slug} state={wp} />}
      {openai && <OpenAiCard slug={slug} state={openai} />}

      {connectors
        .filter((c) => !['woocommerce', 'wordpress', 'openai'].includes(c.type))
        .map((c) => <OtherCard key={c.type} state={c} />)}
    </div>
  )
}

// Chave da OpenAI, usada só pra gerar capa de post. O texto do produto continua
// no Anthropic. A chave é validada contra a API antes de ser cifrada e salva.
function OpenAiCard({ slug, state }: { slug: string; state: ConnectorState }) {
  const router = useRouter()
  const t = useTranslations('integrations')
  const connected = state.status === 'connected'
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'paywall'; text: string } | null>(null)

  const statusLabel = ['connected', 'disconnected', 'error'].includes(state.status) ? t(`status_${state.status}`) : state.status
  const statusCls = STATUS_CLS[state.status] ?? 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-muted)]'

  async function test() {
    setBusy('test'); setMsg(null)
    const res = await testOpenai(slug, apiKey.trim())
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('openai_test_ok') })
  }

  async function connect() {
    setBusy('connect'); setMsg(null)
    const res = await connectOpenai(slug, apiKey.trim())
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('connected_ok') })
    setOpen(false); setApiKey('')
    router.refresh()
  }

  async function disconnect() {
    if (!confirm(t('disconnect_confirm'))) return
    setBusy('disconnect')
    const res = await disconnectConnector(slug, 'openai')
    setBusy(null)
    if (res.ok) router.refresh()
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex flex-wrap items-start gap-5 justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className="size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-[0_8px_22px_-8px_var(--uc-accent-glow)]" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
            <Icon name="sparkle" size={22} />
          </span>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold tracking-tight text-[var(--uc-text)]">OpenAI</h3>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${statusCls}`}>{statusLabel}</span>
            </div>
            <p className="text-sm leading-6 text-[var(--uc-text-soft)] max-w-xl">{t('openai_description')}</p>
            {state.last_error && <p className="text-xs text-[var(--uc-danger)]">{state.last_error}</p>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {connected || state.status === 'error' ? (
            <GlassButton size="sm" variant="ghost" loading={busy === 'disconnect'} onClick={disconnect}>{t('disconnect')}</GlassButton>
          ) : state.allowed ? (
            <GlassButton size="sm" onClick={() => setOpen((v) => !v)}>{open ? t('close') : t('connect')}</GlassButton>
          ) : (
            <span className="text-xs text-[var(--uc-text-muted)] self-center">{t('out_of_plan')}</span>
          )}
        </div>
      </div>

      {open && !connected && (
        <div className="space-y-3 border-t border-[var(--uc-border)] pt-4">
          <GlassInput label={t('openai_api_key')} placeholder="sk-..." type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          <p className="text-xs text-[var(--uc-text-muted)] leading-5">{t('openai_api_key_hint')}</p>
          <div className="flex gap-2">
            <GlassButton variant="secondary" loading={busy === 'test'} disabled={!apiKey.trim()} onClick={test}>{t('test_connection')}</GlassButton>
            <GlassButton loading={busy === 'connect'} disabled={!apiKey.trim()} onClick={connect}>{t('connect')}</GlassButton>
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

// WordPress é destino de publicação, não origem de catálogo: por isso não tem
// botão de sincronizar como o WooCommerce.
function WordpressCard({ slug, state }: { slug: string; state: ConnectorState }) {
  const router = useRouter()
  const t = useTranslations('integrations')
  const connected = state.status === 'connected'
  const [open, setOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [username, setUsername] = useState('')
  const [appPassword, setAppPassword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'paywall'; text: string } | null>(null)

  const statusLabel = ['connected', 'disconnected', 'error'].includes(state.status) ? t(`status_${state.status}`) : state.status
  const statusCls = STATUS_CLS[state.status] ?? 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-muted)]'
  const filled = Boolean(baseUrl.trim() && username.trim() && appPassword.trim())

  function creds() {
    return {
      base_url: baseUrl.trim(),
      username: username.trim(),
      application_password: appPassword.trim(),
    }
  }

  async function test() {
    setBusy('test'); setMsg(null)
    const res = await testWordpress(slug, creds())
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('wp_test_ok') })
  }

  async function connect() {
    setBusy('connect'); setMsg(null)
    const res = await connectWordpress(slug, creds())
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('connected_ok') })
    setOpen(false); setUsername(''); setAppPassword('')
    router.refresh()
  }

  async function disconnect() {
    if (!confirm(t('disconnect_confirm'))) return
    setBusy('disconnect')
    const res = await disconnectConnector(slug, 'wordpress')
    setBusy(null)
    if (res.ok) router.refresh()
  }

  return (
    <GlassCard className="p-6 space-y-4">
      <div className="flex flex-wrap items-start gap-5 justify-between">
        <div className="flex items-start gap-4 min-w-0">
          <span className="size-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-[0_8px_22px_-8px_var(--uc-accent-glow)]" style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple) 0%, var(--uc-brand-blue) 100%)' }}>
            <Icon name="blog" size={22} />
          </span>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold tracking-tight text-[var(--uc-text)]">WordPress</h3>
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${statusCls}`}>{statusLabel}</span>
            </div>
            <p className="text-sm leading-6 text-[var(--uc-text-soft)] max-w-xl">{t('wp_description')}</p>
            {state.last_error && <p className="text-xs text-[var(--uc-danger)]">{state.last_error}</p>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {connected || state.status === 'error' ? (
            <GlassButton size="sm" variant="ghost" loading={busy === 'disconnect'} onClick={disconnect}>{t('disconnect')}</GlassButton>
          ) : state.allowed ? (
            <GlassButton size="sm" onClick={() => setOpen((v) => !v)}>{open ? t('close') : t('connect')}</GlassButton>
          ) : (
            <span className="text-xs text-[var(--uc-text-muted)] self-center">{t('out_of_plan')}</span>
          )}
        </div>
      </div>

      {open && !connected && (
        <div className="space-y-3 border-t border-[var(--uc-border)] pt-4">
          <GlassInput label={t('wp_site_url')} placeholder={t('wp_site_url_placeholder')} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <GlassInput label={t('wp_username')} placeholder={t('wp_username_placeholder')} value={username} onChange={(e) => setUsername(e.target.value)} />
          <GlassInput label={t('wp_app_password')} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" type="password" value={appPassword} onChange={(e) => setAppPassword(e.target.value)} />
          <p className="text-xs text-[var(--uc-text-muted)] leading-5">{t('wp_app_password_hint')}</p>
          <div className="flex gap-2">
            <GlassButton variant="secondary" loading={busy === 'test'} disabled={!filled} onClick={test}>{t('test_connection')}</GlassButton>
            <GlassButton loading={busy === 'connect'} disabled={!filled} onClick={connect}>{t('connect')}</GlassButton>
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

function WooCard({ slug, state, productsCount }: { slug: string; state: ConnectorState; productsCount: number }) {
  const router = useRouter()
  const t = useTranslations('integrations')
  const connected = state.status === 'connected'
  const [open, setOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [ck, setCk] = useState('')
  const [cs, setCs] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'paywall'; text: string } | null>(null)

  const statusLabel = ['connected', 'disconnected', 'error'].includes(state.status) ? t(`status_${state.status}`) : state.status
  const statusCls = STATUS_CLS[state.status] ?? 'bg-[var(--uc-surface-soft)] text-[var(--uc-text-muted)]'

  async function test() {
    setBusy('test'); setMsg(null)
    const res = await testWoo(slug, { base_url: baseUrl.trim(), consumer_key: ck.trim(), consumer_secret: cs.trim() })
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('test_ok', { total: res.data.total }) })
  }

  async function connect() {
    setBusy('connect'); setMsg(null)
    const res = await connectWoo(slug, { base_url: baseUrl.trim(), consumer_key: ck.trim(), consumer_secret: cs.trim() })
    setBusy(null)
    if (!res.ok) { setMsg({ kind: res.error === 'feature_locked' ? 'paywall' : 'err', text: res.message }); return }
    setMsg({ kind: 'ok', text: t('connected_ok') })
    setOpen(false); setCk(''); setCs('')
    router.refresh()
  }

  async function sync() {
    setBusy('sync'); setMsg(null)
    const res = await syncConnector(slug, 'woocommerce')
    setBusy(null)
    setMsg(res.ok ? { kind: 'ok', text: t('sync_queued') } : { kind: 'err', text: res.message })
  }

  async function disconnect() {
    if (!confirm(t('disconnect_confirm'))) return
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
              <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${statusCls}`}>{statusLabel}</span>
            </div>
            <p className="text-sm leading-6 text-[var(--uc-text-soft)] max-w-xl">
              {t('woo_description')}
            </p>
            {connected && (
              <p className="text-xs text-[var(--uc-text-muted)]">
                {t('products_synced', { count: productsCount, sync: state.last_sync_at ? t('last_sync', { date: new Date(state.last_sync_at).toLocaleString() }) : t('sync_pending') })}
              </p>
            )}
            {state.last_error && <p className="text-xs text-[var(--uc-danger)]">{state.last_error}</p>}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {connected || state.status === 'error' ? (
            <>
              <GlassButton size="sm" variant="secondary" loading={busy === 'sync'} onClick={sync}>{t('sync')}</GlassButton>
              <GlassButton size="sm" variant="ghost" loading={busy === 'disconnect'} onClick={disconnect}>{t('disconnect')}</GlassButton>
            </>
          ) : state.allowed ? (
            <GlassButton size="sm" onClick={() => setOpen((v) => !v)}>{open ? t('close') : t('connect')}</GlassButton>
          ) : (
            <span className="text-xs text-[var(--uc-text-muted)] self-center">{t('out_of_plan')}</span>
          )}
        </div>
      </div>

      {open && !connected && (
        <div className="space-y-3 border-t border-[var(--uc-border)] pt-4">
          <GlassInput label={t('store_url')} placeholder={t('store_url_placeholder')} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <GlassInput label={t('consumer_key')} placeholder="ck_..." value={ck} onChange={(e) => setCk(e.target.value)} />
          <GlassInput label={t('consumer_secret')} placeholder="cs_..." type="password" value={cs} onChange={(e) => setCs(e.target.value)} />
          <p className="text-xs text-[var(--uc-text-muted)] leading-5">
            {t('keys_hint')}
          </p>
          <div className="flex gap-2">
            <GlassButton variant="secondary" loading={busy === 'test'} disabled={!baseUrl || !ck || !cs} onClick={test}>{t('test_connection')}</GlassButton>
            <GlassButton loading={busy === 'connect'} disabled={!baseUrl || !ck || !cs} onClick={connect}>{t('connect_sync')}</GlassButton>
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
  const t = useTranslations('integrations')
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
              {t('coming_soon')}
            </span>
          </div>
          <p className="text-sm text-[var(--uc-text-soft)]">{t('available_next')}</p>
        </div>
      </div>
      <button type="button" disabled className="px-5 py-2.5 rounded-2xl text-sm font-semibold text-[var(--uc-text-muted)] bg-[var(--uc-surface-2)] cursor-not-allowed opacity-60">
        {t('coming_soon')}
      </button>
    </GlassCard>
  )
}
