'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, Bus, LogIn, LogOut, Map, Search, Shield, Star, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'

const navItems = [
  { href: '/', label: 'Favoris', icon: Star },
  { href: '/search', label: 'Recherche', icon: Search },
  { href: '/map', label: 'Carte', icon: Map },
  { href: '/alerts', label: 'Alertes', icon: AlertTriangle },
]

export function NavBar() {
  const pathname = usePathname()
  const { user, isAdmin, loading, signOut } = useUser()

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold text-accent-cyan">
          <Bus className="h-5 w-5" />
          BusWave
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'text-muted hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}

          {/* Auth button */}
          {!loading && (
            user ? (
              <div className="flex items-center gap-1 ml-1">
                {isAdmin && (
                  <span title="Administrateur" className="text-yellow-400">
                    <Shield className="h-3.5 w-3.5" />
                  </span>
                )}
                <span className="hidden sm:flex items-center gap-1 text-xs text-muted px-2">
                  <User className="h-3 w-3" />
                  {user.email?.split('@')[0]}
                </span>
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
