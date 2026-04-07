'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Search, Sparkles, MapPin, Star } from 'lucide-react'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { useUser } from '@/hooks/useUser'
import { FavoriteCard } from '@/components/bus/FavoriteCard'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { GradientText } from '@/components/ui/GradientText'

const FavoritesMiniMap = dynamic(
  () => import('@/components/map/FavoritesMiniMap').then((m) => m.FavoritesMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-3xl glass shadow-glass animate-pulse" style={{ height: 280 }} />
    ),
  }
)

export default function HomePage() {
  const favorites = useFavoritesStore(selectFavorites)
  const { user } = useUser()

  return (
    <div className="space-y-5">
      {/* Welcome header */}
      <div className="animate-fade-up">
        <p className="text-ink2 font-medium text-sm">
          {user ? 'Bon retour parmi nous' : 'Bienvenue sur'}
        </p>
        <GradientText as="h1" className="text-4xl font-extrabold leading-tight tracking-tight">
          {user?.email?.split('@')[0] ?? 'BusWave'}
        </GradientText>
      </div>

      {/* Hero search */}
      <Link href="/search" className="block animate-fade-up">
        <Card variant="glass" className="!p-3 hover:shadow-glow-cyan transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-btn-cyan shadow-glow-cyan shrink-0">
              <Search className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">Chercher un arrêt ou ligne</p>
              <p className="text-xs text-ink3 font-medium">Ajoute-le à tes favoris</p>
            </div>
          </div>
        </Card>
      </Link>

      {/* Empty state OR mini-map + favorites */}
      {favorites.length === 0 ? (
        <Card variant="glow" className="text-center py-10 animate-fade-up">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-btn-primary shadow-glow animate-pulse-glow">
            <Sparkles className="h-10 w-10 text-white" strokeWidth={2.5} />
          </div>
          <GradientText as="h2" className="text-2xl font-extrabold mb-2 block">
            Commence ici
          </GradientText>
          <p className="text-ink2 font-medium mb-6 px-4">
            Ajoute un arrêt pour suivre tes bus en temps réel sur la carte
          </p>
          <Link href="/search">
            <Button
              variant="primary"
              size="lg"
              iconLeft={<Search className="h-5 w-5" strokeWidth={2.5} />}
            >
              Trouver un arrêt
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          {/* Section title: live bus map */}
          <div className="space-y-2 animate-fade-up">
            <div className="flex items-center gap-2 px-1">
              <MapPin className="h-4 w-4 text-cyan-light glow-cyan" strokeWidth={2.5} />
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-ink2">
                Mes bus en route
              </h2>
            </div>
            <FavoritesMiniMap favorites={favorites} height={280} />
          </div>

          {/* Section title: favorites */}
          <div className="space-y-3 animate-fade-up">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-sun glow-purple" strokeWidth={2.5} />
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-ink2">
                  Mes favoris
                </h2>
              </div>
              <span className="text-xs text-ink3 font-bold">
                {favorites.length} arrêt{favorites.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {favorites.map((fav) => (
                <FavoriteCard key={fav.id} stopId={fav.stopId} routeId={fav.routeId ?? null} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
