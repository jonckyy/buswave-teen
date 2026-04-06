'use client'

import Link from 'next/link'
import { Search, Sparkles } from 'lucide-react'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { FavoriteCard } from '@/components/bus/FavoriteCard'
import { Button } from '@/components/ui/Button'

export default function HomePage() {
  const favorites = useFavoritesStore(selectFavorites)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-3xl font-extrabold text-ink leading-tight">Mes favoris</h1>
          <p className="text-ink2 font-medium">
            {favorites.length === 0
              ? 'Aucun pour le moment'
              : `${favorites.length} arrêt${favorites.length > 1 ? 's' : ''} suivi${favorites.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link href="/search">
          <Button variant="primary" size="md" iconLeft={<Search className="h-4 w-4" strokeWidth={2.5} />}>
            Ajouter
          </Button>
        </Link>
      </div>

      {/* Empty state */}
      {favorites.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-primary-300 bg-primary-50 p-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary-600 text-white shadow-pop">
            <Sparkles className="h-10 w-10" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-extrabold text-ink mb-2">Bienvenue !</h2>
          <p className="text-ink2 font-medium mb-6">
            Ajoute un arrêt pour suivre tes bus en temps réel
          </p>
          <Link href="/search">
            <Button variant="primary" size="lg" iconLeft={<Search className="h-5 w-5" strokeWidth={2.5} />}>
              Trouver un arrêt
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {favorites.map((fav) => (
            <FavoriteCard key={fav.id} stopId={fav.stopId} routeId={fav.routeId ?? null} />
          ))}
        </div>
      )}
    </div>
  )
}
