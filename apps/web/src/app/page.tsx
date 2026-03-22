'use client'

import Link from 'next/link'
import { Search } from 'lucide-react'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { BusCard } from '@/components/bus/BusCard'
import { AlertsBanner } from '@/components/AlertsBanner'

export default function HomePage() {
  const favorites = useFavoritesStore(selectFavorites)

  return (
    <div>
      <AlertsBanner />

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Mes favoris</h1>
        <Link
          href="/search"
          className="flex items-center gap-2 rounded-lg bg-accent-cyan/10 px-3 py-2 text-sm font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
        >
          <Search className="h-4 w-4" />
          Ajouter
        </Link>
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-muted mb-2">Aucun favori enregistré</p>
          <Link href="/search" className="text-accent-cyan text-sm hover:underline">
            Rechercher un arrêt ou une ligne →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {favorites.map((fav) => (
            <BusCard key={fav.id} stopId={fav.stopId} routeId={fav.routeId ?? null} />
          ))}
        </div>
      )}
    </div>
  )
}
