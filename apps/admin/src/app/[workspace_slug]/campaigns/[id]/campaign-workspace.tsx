'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { Icon, type IconName } from '@/components/shell/icon'
import { GlassButton, GlassCard, fieldCls } from '@/components/ui'
import { cn } from '@/lib/cn'
import { generateSequence } from '@/lib/api/mutations'
import type { Channel, CampaignSequence, PieceType } from '@/lib/api/types'

type Props = {
  slug: string
  campaignId: string
  channels: Channel[]
  sequences: CampaignSequence[]
}

export function CampaignWorkspace({ slug, campaignId, channels, sequences }: Props) {
  const t = useTranslations('campaigns')
  const router = useRouter()

  const channelMap = useMemo(() => new Map(channels.map((c) => [c.key, c])), [channels])
  const [building, setBuilding] = useState(false)

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[var(--uc-text)] tracking-tight">{t('sequences_title')}</h2>
        {!building && (
          <GlassButton size="sm" onClick={() => setBuilding(true)}>
            <Icon name="plus" size={16} />{t('add_sequence')}
          </GlassButton>
        )}
      </div>

      {building && (
        <SequenceBuilder
          slug={slug}
          campaignId={campaignId}
          channels={channels}
          onClose={() => setBuilding(false)}
          onDone={() => { setBuilding(false); router.refresh() }}
        />
      )}

      {sequences.length === 0 && !building ? (
        <GlassCard className="p-10 text-center" iridescent>
          <span
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl text-white"
            style={{ background: 'linear-gradient(135deg, var(--uc-brand-purple), var(--uc-brand-blue))' }}
          >
            <Icon name="campaign" size={26} />
          </span>
          <h3 className="text-base font-bold text-[var(--uc-text)]">{t('empty_seq_title')}</h3>
          <p className="text-sm text-[var(--uc-text-soft)] mt-1 max-w-md mx-auto">{t('empty_seq_desc')}</p>
          <div className="mt-5">
            <GlassButton onClick={() => setBuilding(true)}><Icon name="plus" size={16} />{t('add_sequence')}</GlassButton>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-5">
          {sequences.map((seq) => {
            const ch = seq.channel ? channelMap.get(seq.channel) : undefined
            return (
              <section key={seq.channel ?? 'none'} className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <ChannelBadge channel={ch} fallback={seq.channel ?? '—'} />
                  <span className="text-xs text-[var(--uc-text-faint)]">
                    {t('steps_count', { count: seq.steps.length })}
                  </span>
                </div>
                <div className="space-y-2.5">
                  {seq.steps.map((step) => (
                    <Link
                      key={step.id}
                      href={`/${slug}/copy/${step.id}`}
                      className="group block cursor-pointer"
                    >
                      <GlassCard className="p-4 flex items-start gap-4 uc-transition-fast hover:translate-y-[-2px]">
                        <span
                          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold text-white"
                          style={{ background: ch?.color ?? 'var(--uc-bg-mute)' }}
                        >
                          {step.sequence_index ?? '•'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-semibold text-[var(--uc-text)] truncate">{step.title}</h4>
                          {step.current_content_preview && (
                            <p className="text-xs leading-5 text-[var(--uc-text-muted)] mt-1 line-clamp-2">
                              {step.current_content_preview}
                            </p>
                          )}
                        </div>
                        <Icon name="chevron-right" className="mt-1 shrink-0 text-[var(--uc-text-faint)] group-hover:text-[var(--uc-text)]" />
                      </GlassCard>
                    </Link>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChannelBadge({ channel, fallback }: { channel?: Channel; fallback: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
      style={{ background: channel ? `${channel.color}1a` : 'var(--uc-surface-soft)', color: channel?.color ?? 'var(--uc-text-soft)' }}>
      {channel && <Icon name={channel.icon as IconName} size={14} />}
      {channel?.name ?? fallback}
    </span>
  )
}

function SequenceBuilder({
  slug, campaignId, channels, onClose, onDone,
}: {
  slug: string
  campaignId: string
  channels: Channel[]
  onClose: () => void
  onDone: () => void
}) {
  const t = useTranslations('campaigns')
  const tc = useTranslations('common')

  const [channelKey, setChannelKey] = useState<string>('')
  const [pieceKey, setPieceKey] = useState<string>('')
  const [steps, setSteps] = useState(3)
  const [angle, setAngle] = useState('')
  const [brief, setBrief] = useState('')
  const [model, setModel] = useState('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ANGLES = ['urgencia', 'escassez', 'prova', 'beneficio', 'story', 'objecao', 'oferta'] as const

  const channel = channels.find((c) => c.key === channelKey)
  const pieces: PieceType[] = channel?.piece_types ?? []

  function pickChannel(c: Channel) {
    setChannelKey(c.key)
    setPieceKey(c.piece_types[0]?.key ?? '')
    setSteps(c.sequence ? 3 : 1)
    setError(null)
  }

  async function run() {
    setLoading(true); setError(null)
    const angleHint = angle ? `${t('angle_label')}: ${t(`angle_${angle}`)}. ` : ''
    const fullBrief = `${angleHint}${brief.trim()}`.trim()
    const res = await generateSequence(slug, campaignId, {
      channel: channelKey,
      piece_type_key: pieceKey || undefined,
      steps,
      brief: fullBrief || undefined,
      model,
    })
    setLoading(false)
    if (!res.ok) { setError(res.message); return }
    onDone()
  }

  return (
    <GlassCard className="p-5 sm:p-6 space-y-5" glow>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[var(--uc-text)]">{t('new_sequence')}</h3>
        <button type="button" onClick={onClose} aria-label={tc('cancel')}
          className="rounded-lg p-1.5 text-[var(--uc-text-muted)] hover:bg-[var(--uc-surface-soft)] hover:text-[var(--uc-text)] cursor-pointer">
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* 1 — Canal */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-muted)]">{t('pick_channel')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {channels.map((c) => {
            const active = channelKey === c.key
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => pickChannel(c)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-2xl p-3.5 border text-left uc-transition-fast cursor-pointer',
                  active
                    ? 'border-[var(--uc-accent-ring)] bg-[var(--uc-accent-soft)] shadow-[0_0_0_3px_var(--uc-accent-soft-2)]'
                    : 'border-[var(--uc-border)] bg-[var(--uc-bg-mute)] hover:border-[var(--uc-border-strong)] hover:-translate-y-0.5',
                )}
              >
                <span className="grid size-9 place-items-center rounded-xl text-white shrink-0"
                  style={{ background: c.color }}>
                  <Icon name={c.icon as IconName} size={18} />
                </span>
                <span className="text-sm font-semibold text-[var(--uc-text)] leading-tight">{c.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {channel && (
        <>
          {/* 2 — Formato */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-muted)]">{t('pick_format')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {pieces.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPieceKey(p.key)}
                  className={cn(
                    'rounded-2xl p-3.5 border text-left uc-transition-fast cursor-pointer',
                    pieceKey === p.key
                      ? 'border-[var(--uc-accent-ring)] bg-[var(--uc-accent-soft)] shadow-[0_0_0_3px_var(--uc-accent-soft-2)]'
                      : 'border-[var(--uc-border)] bg-[var(--uc-bg-mute)] hover:border-[var(--uc-border-strong)]',
                  )}
                >
                  <span className="text-sm font-semibold text-[var(--uc-text)]">{p.name}</span>
                  {(p.length_hint || p.description) && (
                    <p className="text-xs text-[var(--uc-text-muted)] mt-1 line-clamp-2 leading-5">{p.length_hint ?? p.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 3 — Ângulo (massa) */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--uc-text-muted)] flex items-center gap-1.5">
              <Icon name="target" size={13} />{t('angle_label')}
            </p>
            <div className="flex flex-wrap gap-2">
              {(['', ...ANGLES] as string[]).map((a) => {
                const active = angle === a
                return (
                  <button
                    key={a || 'none'}
                    type="button"
                    onClick={() => setAngle(a)}
                    className={cn(
                      'px-3 h-8 rounded-full text-xs font-semibold uc-transition-fast cursor-pointer border',
                      active
                        ? 'border-[var(--uc-accent-ring)] bg-[var(--uc-accent-soft)] text-[var(--uc-accent)]'
                        : 'border-[var(--uc-border)] text-[var(--uc-text-soft)] hover:text-[var(--uc-text)] hover:border-[var(--uc-border-strong)]',
                    )}
                  >
                    {a ? t(`angle_${a}`) : t('angle_none')}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4 — Passos + brief + modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4">
            <div>
              <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('steps_label')}</label>
              <select className={cn(fieldCls, 'h-12')} value={steps} onChange={(e) => setSteps(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6, 7].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">{t('seq_model')}</label>
              <select className={cn(fieldCls, 'h-12')} value={model} onChange={(e) => setModel(e.target.value)}>
                {['auto', 'haiku', 'sonnet', 'opus'].map((m) => <option key={m} value={m}>{m === 'auto' ? 'Auto' : m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold tracking-wide uppercase text-[var(--uc-text-muted)] mb-1.5 block">
              {t('seq_brief')} <span className="normal-case text-[var(--uc-text-faint)]">{tc('optional')}</span>
            </label>
            <textarea rows={3} className={cn(fieldCls, 'py-3 resize-y leading-7')} placeholder={t('seq_brief_ph')} value={brief} onChange={(e) => setBrief(e.target.value)} />
          </div>

          {error && (
            <div className="rounded-2xl border border-[var(--uc-danger)]/40 bg-[var(--uc-danger)]/10 px-4 py-3 text-sm text-[var(--uc-danger)]">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <GlassButton variant="ghost" onClick={onClose}>{tc('cancel')}</GlassButton>
            <GlassButton size="lg" loading={loading} disabled={!channelKey} onClick={run}>
              {!loading && <Icon name="spark" size={18} />}
              {loading ? t('generating_sequence') : t('generate_sequence')}
            </GlassButton>
          </div>
        </>
      )}
    </GlassCard>
  )
}
