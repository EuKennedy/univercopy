import path from 'node:path'
import { fileURLToPath } from 'node:url'
import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// Monorepo standalone — Next precisa do tracing root no topo do repo,
// senão o output pula node_modules das workspaces (@univer/shared).
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..')

const nextConfig: NextConfig = {
  transpilePackages: ['@univer/shared'],

  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,

  experimental: {
    // 12mb cobre uma capa de post de até 8MB depois do inchaço de ~33% do
    // base64. O teto de 8MB é aplicado no cliente e revalidado no Rails.
    serverActions: { bodySizeLimit: '12mb' },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
