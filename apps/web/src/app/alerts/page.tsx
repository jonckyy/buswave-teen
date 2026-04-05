'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Star } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { cn } from '@/lib/utils'
import type { Alert } from '@buswave/shared'

const TWO_HOURS = 2 * 60 * 60

function isRecent(alert: Alert): boolean {
  if (!alert.activePeriodStart) return true // no timestamp → keep
  const nowSec = Math.floor(Date.now() / 1000)
  return nowSec - alert.activePeriodStart <= TWO_HOURS
}

function formatTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('fr-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AlertsPage() {
  const favorites = useFavoritesStore(selectFavorites)
  const [filterMode, setFilterMode] = useState<'all' | 'favorites'>(() =>
    favorites.length > 0 ? 'favorites' : 'all'
  )

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.alerts,
    refetchInterval: 60_000,
  })

  // Extract unique routeIds and stopIds from favorites
  const favRouteIds = useMemo(
    () => new Set(favorites.map((f) => f.routeId).filter(Boolean) as string[]),
    [favorites]
  )
  const favStopIds = useMemo(
    () => new Set(favorites.map((f) => f.stopId)),
    [favorites]
  )

  // Collect all routeIds from alerts for name lookup
  const allRouteIds = useMemo(
    () => [...new Set(alerts.flatMap((a) => a.routeIds))],
    [alerts]
  )

  const { data: routeNames = [] } = useQuery({
    queryKey: ['route-names', allRouteIds.join(',')],
    queryFn: () => api.routeNames(allRouteIds),
    enabled: allRouteIds.length > 0,
    staleTime: 5 * 60_000,
  })

  const routeNameMap = useMemo(
    () => new Map(routeNames.map((r) => [r.route_id, r.route_short_name])),
    [routeNames]
  )

  const recent = alerts.filter(isRecent)

  const filtered = useMemo(() => {
    if (filterMode === 'all' || favRouteIds.size === 0) return recent
    return recent.filter((alert) => {
      // No informed entities → system-wide alert, always show
      if (alert.routeIds.length === 0 && alert.stopIds.length === 0) return true
      // Match by route
      if (alert.routeIds.some((id) => favRouteIds.has(id))) return true
      // Match by stop
      if (alert.stopIds.some((id) => favStopIds.has(id))) return true
      return false
    })
  }, [recent, filterMode, favRouteIds, favStopIds])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Alertes reseau</h1>

        {/* Filter toggle */}
        {favorites.length > 0 && (
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filterMode === 'all'
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'text-muted hover:text-white'
              )}
            >
              Toutes
            </button>
            <button
              onClick={() => setFilterMode('favorites')}
              className={cn(
                'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filterMode === 'favorites'
                  ? 'bg-accent-cyan/10 text-accent-cyan'
                  : 'text-muted hover:text-white'
              )}
            >
              <Star className="h-3 w-3" />
              Mes lignes ({favRouteIds.size})
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-muted">
            {filterMode === 'favorites'
              ? 'Aucune alerte pour vos lignes favorites'
              : 'Aucune alerte ces 2 dernieres heures'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-3 rounded-lg border border-slight-delay/30 bg-slight-delay/10 px-4 py-3"
            >
              <AlertTriangle className="h-4 w-4 text-slight-delay shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slight-delay">{alert.headerText}</p>
                  {alert.activePeriodStart && (
                    <span className="text-xs text-muted shrink-0">{formatTime(alert.activePeriodStart)}</span>
                  )}
                </div>
                {/* Route badges */}
                {alert.routeIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {alert.routeIds.map((rid) => (
                      <span
                        key={rid}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          favRouteIds.has(rid)
                            ? 'bg-accent-cyan/20 text-accent-cyan'
                            : 'bg-white/10 text-muted'
                        )}
                      >
                        {routeNameMap.get(rid) ?? rid}
                      </span>
                    ))}
                  </div>
                )}
                {alert.descriptionText && alert.descriptionText !== alert.headerText && (
                  <p className="text-xs text-muted mt-1">{alert.descriptionText}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
