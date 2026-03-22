'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Check, Bus, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore } from '@/store/favorites'
import { cn } from '@/lib/utils'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const addFavorite = useFavoritesStore((s) => s.addFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes-search', query],
    queryFn: () => api.searchRoutes(query),
    enabled: query.length >= 2,
    staleTime: 5_000,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Recherche</h1>

      {/* Search input */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Numéro ou nom de ligne…"
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-white placeholder:text-muted focus:border-accent-cyan focus:outline-none"
        />
      </div>

      {/* Results */}
      {query.length >= 2 && (
        <div className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
            ))
          ) : routes.length === 0 ? (
            <p className="text-muted text-center py-8">Aucun résultat pour « {query} »</p>
          ) : (
            routes.map((route) => {
              const already = isFavorite('', route.route_id)
              return (
                <div
                  key={route.route_id}
                  className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-sm font-bold text-accent-cyan">
                      {route.route_short_name}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{route.route_long_name}</p>
                      <p className="text-xs text-muted">Ligne TEC</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* TODO: link to line page */}
                    <button
                      onClick={() =>
                        addFavorite({
                          stopId: '',
                          routeId: route.route_id,
                          userId: null,
                          label: route.route_short_name,
                        })
                      }
                      disabled={already}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        already
                          ? 'bg-on-time/10 text-on-time cursor-default'
                          : 'bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20'
                      )}
                    >
                      {already ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Ajouté
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Favori
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {query.length < 2 && (
        <p className="text-muted text-center py-8 text-sm">
          Tapez au moins 2 caractères pour rechercher
        </p>
      )}
    </div>
  )
}
