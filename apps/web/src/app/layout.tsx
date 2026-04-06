import type { Metadata, Viewport } from 'next'
import { Providers } from '@/components/Providers'
import { NavBar } from '@/components/NavBar'
import './globals.css'

export const metadata: Metadata = {
  title: 'BusWave',
  description: 'Suis tes bus TEC en temps réel — version fun',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: '#7C3AED',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh font-body antialiased">
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-2xl px-4 pb-24 pt-4 sm:pt-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
