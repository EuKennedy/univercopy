import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'UniverCopy',
    template: '%s · UniverCopy',
  },
  description: 'Hub world-class de geração, revisão e organização de copy.',
  applicationName: 'UniverCopy',
  authors: [{ name: 'UniverCopy' }],
  // Indexação só na landing — admin é privado.
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Locale default = pt-BR. O switcher de idioma na Fase 3 troca via cookie + middleware.
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
