import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/Providers'
import { NavBar } from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'BusWave — TEC Live Tracker',
  description: 'Real-time bus tracking for the TEC network in Belgium',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-background text-white">
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
