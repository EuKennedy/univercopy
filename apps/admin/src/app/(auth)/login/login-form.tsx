'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { GlassButton, GlassCard, GlassInput } from '@/components/ui'
import { authClient } from '@/lib/auth-client'

type Mode = 'password' | 'magic'

export function LoginForm() {
  const t = useTranslations()
  const router = useRouter()
  const params = useSearchParams()
  const nextPath = params.get('next') ?? '/'

  const [mode, setMode] = useState<Mode>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'password') {
        const res = await authClient.signIn.email({ email, password })
        if (res.error) {
          setError(res.error.message ?? t('common.error_generic'))
          return
        }
        router.replace(nextPath)
      } else {
        const res = await authClient.signIn.magicLink({ email, callbackURL: nextPath })
        if (res.error) {
          setError(res.error.message ?? t('common.error_generic'))
          return
        }
        setMagicSent(true)
      }
    } catch {
      setError(t('common.error_generic'))
    } finally {
      setLoading(false)
    }
  }

  if (magicSent) {
    return (
      <GlassCard variant="strong" iridescent glow className="p-8 text-center space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--uc-text)]">
          Link enviado
        </h2>
        <p className="text-sm text-[var(--uc-text-soft)]">
          Confira sua caixa de entrada em <strong>{email}</strong> e clique no link mágico para entrar.
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="strong" iridescent glow className="p-7 sm:p-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <GlassInput
          label={t('auth.email_label')}
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@suamarca.com"
        />

        {mode === 'password' && (
          <GlassInput
            label={t('auth.password_label')}
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl px-4 py-3 text-sm bg-[var(--uc-danger-bg)] text-[var(--uc-danger)] border border-[var(--uc-danger)]"
          >
            {error}
          </div>
        )}

        <GlassButton type="submit" size="lg" loading={loading} className="w-full">
          {mode === 'password' ? t('auth.submit') : t('auth.magic_link')}
        </GlassButton>

        <button
          type="button"
          onClick={() => setMode(mode === 'password' ? 'magic' : 'password')}
          className="text-sm font-medium text-[var(--uc-text-muted)] hover:text-[var(--uc-text)] uc-transition cursor-pointer"
        >
          {mode === 'password' ? t('auth.magic_link') : t('auth.submit')}
        </button>
      </form>
    </GlassCard>
  )
}
