'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Star, Search, Map, Bell, User, Shield, Bus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { GradientText } from '@/components/ui/GradientText'

export function NavBar() {
  const pathname = usePathname()
  const { user, isAdmin } = useUser()
  const flags = useFeatureFlags()

  const items = [
    { href: '/', label: 'Favoris', icon: Star },
    { href: '/search', label: 'Trouver', icon: Search },
    { href: '/map', label: 'Carte', icon: Map },
    ...(flags.showAlertsPage ? [{ href: '/alerts', label: 'Alertes', icon: Bell }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
    { href: user ? '/settings' : '/auth', label: user ? 'Moi' : 'Login', icon: User },
  ]

  return (
    <>
      {/* Top brand bar */}
      <header className="sticky top-0 z-40 glass-deep border-b border-line">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 pressable">
            <div className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-btn-primary shadow-glow">
                <Bus className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-btn-primary blur-xl opacity-50 -z-10" />
            </div>
            <GradientText as="span" className="text-2xl font-extrabold tracking-tight">
              BusWave
            </GradientText>
          </Link>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-deep border-t border-line pb-safe">
        <div className="mx-auto max-w-2xl flex items-center justify-around px-2 py-2">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 pressable rounded-2xl min-w-[58px]"
              >
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-300',
                    active
                      ? 'bg-btn-primary text-white shadow-glow scale-110'
                      : 'text-ink2 hover:text-ink'
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <span
                  className={cn(
                    'text-[10px] font-bold transition-colors',
                    active ? 'text-primary-light' : 'text-ink3'
                  )}
                >
                  {label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
