'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowLeft, ChevronRight, MapPin, Check, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore } from '@/store/favorites'
import { cn } from '@/lib/utils'
import type { GtfsRoute, RouteDirection } from '@buswave/shared'

type Step =
  | { type: 'search' }
  | { type: 'direction'; route: GtfsRoute }
  | { type: 'stops'; route: GtfsRoute; direction: RouteDirection }

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [step, setStep] = useState<Step>({ type: 'search' })
  const addFavorite = useFavoritesStore((s) => s.addFavorite)
  const isFavorite = useFavoritesStore((s) => s.isFavorite)

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['routes-search', query],
    queryFn: () => api.searchRoutes(query),
    enabled: step.type === 'search' && query.length >= 2,
    staleTime: 5_000,
  })

  const { data: directions = [], isLoading: loadingDirections } = useQuery({
    queryKey: ['route-stops', step.type !== 'search' ? step.route.route_id : ''],
    queryFn: () => api.routeStops((step as { route: GtfsRoute }).route.route_id),
    enabled: step.type === 'direction',
  })

  function back() {
    if (step.type === 'stops') setStep({ type: 'direction', route: step.route })
    else if (step.type === 'direction') setStep({ type: 'search' })
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {step.type !== 'search' && (
          <button onClick={back} className="text-muted hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-white">
          {step.type === 'search' && 'Recherche'}
          {step.type === 'direction' && (
            <span className="flex items-center gap-2">
              <span className="rounded bg-accent-cyan/10 px-2 py-0.5 text-base font-bold text-accent-cyan">
                {step.route.route_short_name}
              </span>
              Direction
            </span>
          )}
          {step.type === 'stops' && (
            <span className="flex items-center gap-2">
              <span className="rounded bg-accent-cyan/10 px-2 py-0.5 text-base font-bold text-accent-cyan">
                {step.route.route_short_name}
              </span>
              <span className="text-base font-normal text-muted truncate max-w-[180px]">
                → {step.direction.headsign}
              </span>
            </span>
          )}
        </h1>
      </div>

      {/* Step: search */}
      {step.type === 'search' && (
        <>
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Numéro ou nom de ligne…"
              className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-white placeholder:text-muted focus:border-accent-cyan focus:outline-none"
              autoFocus
            />
          </div>

          {query.length >= 2 && (
            <div className="space-y-2">
              {loadingRoutes
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
                  ))
                : routes.length === 0
                ? <p className="text-muted text-center py-8">Aucun résultat pour « {query} »</p>
                : routes.map((route) => (
                    <button
                      key={route.route_id}
                      onClick={() => setStep({ type: 'direction', route })}
                      className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 hover:border-accent-cyan/40 transition-colors text-left"
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
                      <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                    </button>
                  ))}
            </div>
          )}

          {query.length < 2 && (
            <p className="text-muted text-center py-8 text-sm">
              Tapez au moins 2 caractères pour rechercher
            </p>
          )}
        </>
      )}

      {/* Step: choose direction */}
      {step.type === 'direction' && (
        <div className="space-y-3">
          {loadingDirections
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
              ))
            : directions.length === 0
            ? <p className="text-muted text-center py-8">Aucune direction disponible</p>
            : directions.map((dir) => (
                <button
                  key={dir.directionId}
                  onClick={() => setStep({ type: 'stops', route: step.route, direction: dir })}
                  className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-4 py-4 hover:border-accent-cyan/40 transition-colors text-left"
                >
                  <div>
                    <p className="text-xs text-muted mb-0.5">
                      Direction {dir.directionId === 0 ? 'aller' : 'retour'}
                    </p>
                    <p className="text-sm font-medium text-white">→ {dir.headsign}</p>
                    <p className="text-xs text-muted mt-0.5">{dir.stops.length} arrêts</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                </button>
              ))}
        </div>
      )}

      {/* Step: choose stop */}
      {step.type === 'stops' && (
        <div className="space-y-2">
          {step.direction.stops.map((stop, idx) => {
            const already = isFavorite(stop.stop_id, step.route.route_id)
            return (
              <div
                key={stop.stop_id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-muted w-5 text-right shrink-0">{idx + 1}</span>
                  <MapPin className="h-3.5 w-3.5 text-muted shrink-0" />
                  <p className="text-sm text-white truncate">{stop.stop_name}</p>
                </div>
                <button
                  onClick={() =>
                    addFavorite({
                      stopId: stop.stop_id,
                      routeId: step.route.route_id,
                      userId: null,
                      label: `${step.route.route_short_name} · ${stop.stop_name}`,
                    })
                  }
                  disabled={already}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0 ml-2',
                    already
                      ? 'bg-on-time/10 text-on-time cursor-default'
                      : 'bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20'
                  )}
                >
                  {already ? (
                    <><Check className="h-3 w-3" /> Ajouté</>
                  ) : (
                    <><Plus className="h-3 w-3" /> Favori</>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
