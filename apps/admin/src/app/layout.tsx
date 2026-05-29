import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'

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
  // Manifest + icons servidos via convention files (app/icon.svg + apple-icon.svg).
  icons: {
    icon: [
      { url: '/icon.svg',     type: 'image/svg+xml' },
      { url: '/favicon.svg',  type: 'image/svg+xml' },
    ],
    apple: { url: '/apple-icon.svg', sizes: '180x180', type: 'image/svg+xml' },
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)',  color: '#0a0b10' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
