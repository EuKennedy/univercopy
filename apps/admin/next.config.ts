import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pacotes do monorepo precisam ser transpilados pelo Next (TS direto, sem build).
  transpilePackages: ['@univer/shared'],

  // Standalone facilita imagem Docker (copy só do que precisa).
  output: 'standalone',

  experimental: {
    // Server Actions habilitado para mutations sem REST.
    serverActions: { bodySizeLimit: '2mb' },
  },

  // Hardening básico de cabeçalhos. Refinado na Fase 9 (CSP completo).
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

export default nextConfig
