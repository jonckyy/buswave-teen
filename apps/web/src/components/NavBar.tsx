'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, BarChart3, Bus, LogIn, LogOut, Map, Search, Settings, Shield, Star, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

export function NavBar() {
  const pathname = usePathname()
  const { user, isAdmin, loading, signOut } = useUser()
  const flags = useFeatureFlags()

  const navItems = [
    { href: '/', label: 'Favoris', icon: Star },
    { href: '/search', label: 'Recherche', icon: Search },
    { href: '/map', label: 'Carte', icon: Map },
    ...(flags.showAlertsPage ? [{ href: '/alerts', label: 'Alertes', icon: AlertTriangle }] : []),
    ...(flags.showLivePage ? [{ href: '/live', label: 'Live', icon: Bus }] : []),
    ...(isAdmin ? [{ href: '/analytics', label: 'Analytics', icon: BarChart3 }] : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-accent-cyan shrink-0">
          <Bus className="h-5 w-5" />
          <span className="hidden sm:inline">BusWave</span>
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-hide ml-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0',
                pathname === href
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'text-muted hover:text-white'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', href === '/admin' && 'text-yellow-400')} />
              <span className="hidden sm:inline whitespace-nowrap">{label}</span>
            </Link>
          ))}

          {/* Auth button */}
          {!loading && (
            user ? (
              <div className="flex items-center gap-1 ml-1 shrink-0">
                <Link
                  href="/settings"
                  className="flex items-center gap-1 text-xs text-muted px-2 hover:text-white transition-colors"
                >
                  <User className="h-3 w-3 shrink-0" />
                  <span className="hidden md:inline max-w-[100px] truncate">{user.email?.split('@')[0]}</span>
                </Link>
                <button
                  onClick={signOut}
                  title="Se déconnecter"
                  className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-muted hover:text-white transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/auth"
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-1',
                  pathname === '/auth'
                    ? 'bg-accent-cyan/10 text-accent-cyan'
                    : 'text-muted hover:text-white'
                )}
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline">Connexion</span>
              </Link>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
