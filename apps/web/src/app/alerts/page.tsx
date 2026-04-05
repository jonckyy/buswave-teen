'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Star, Clock, CalendarClock } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore, selectFavorites } from '@/store/favorites'
import { cn } from '@/lib/utils'
import type { Alert } from '@buswave/shared'

const TWO_HOURS = 2 * 60 * 60

type TimeFilter = 'active' | 'future' | 'all'

function filterByTime(alert: Alert, mode: TimeFilter): boolean {
  const nowSec = Math.floor(Date.now() / 1000)

  if (mode === 'all') return true

  if (mode === 'future') {
    return alert.activePeriodStart != null && alert.activePeriodStart > nowSec
  }

  // 'active' — currently active or recently started (within 2h)
  if (!alert.activePeriodStart) return true
  if (alert.activePeriodStart > nowSec) return false
  if (alert.activePeriodEnd && alert.activePeriodEnd < nowSec - TWO_HOURS) return false
  return nowSec - alert.activePeriodStart <= TWO_HOURS
    || (alert.activePeriodEnd != null && alert.activePeriodEnd >= nowSec)
}

function formatTime(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString('fr-BE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AlertsPage() {
  const favorites = useFavoritesStore(selectFavorites)
  const [routeFilter, setRouteFilter] = useState<'all' | 'favorites'>(() =>
    favorites.length > 0 ? 'favorites' : 'all'
  )
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('active')

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

  // Resolve favorite routeIds to short names for matching across siblings
  const { data: favRouteData = [] } = useQuery({
    queryKey: ['route-names', [...favRouteIds].join(',')],
    queryFn: () => api.routeNames([...favRouteIds]),
    enabled: favRouteIds.size > 0,
    staleTime: 5 * 60_000,
  })
  const favRouteShortNames = useMemo(
    () => new Set(favRouteData.map((r) => r.route_short_name)),
    [favRouteData]
  )

  const timeFiltered = alerts
    .filter((a) => filterByTime(a, timeFilter))
    .sort((a, b) => (timeFilter === 'future'
      ? (a.activePeriodStart ?? 0) - (b.activePeriodStart ?? 0)
      : (b.activePeriodStart ?? 0) - (a.activePeriodStart ?? 0)))

  const filtered = useMemo(() => {
    if (routeFilter === 'all' || favRouteShortNames.size === 0) return timeFiltered
    return timeFiltered.filter((alert) => {
      // No informed entities → no way to match, skip in favorites mode
      if (alert.routeIds.length === 0 && alert.stopIds.length === 0) return false
      // Match by route short name (handles siblings with different route_ids)
      if (alert.routeShortNames?.some((name) => favRouteShortNames.has(name))) return true
      // Match by stop
      if (alert.stopIds.some((id) => favStopIds.has(id))) return true
      return false
    })
  }, [timeFiltered, routeFilter, favRouteShortNames, favStopIds])

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Alertes reseau</h1>

          {/* Route filter */}
          {favorites.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
              <button
                onClick={() => setRouteFilter('all')}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  routeFilter === 'all'
                    ? 'bg-accent-cyan/10 text-accent-cyan'
                    : 'text-muted hover:text-white'
                )}
              >
                Toutes
              </button>
              <button
                onClick={() => setRouteFilter('favorites')}
                className={cn(
                  'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  routeFilter === 'favorites'
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

        {/* Time filter */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 w-fit">
          <button
            onClick={() => setTimeFilter('active')}
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors',
              timeFilter === 'active'
                ? 'bg-accent-cyan/10 text-accent-cyan'
                : 'text-muted hover:text-white'
            )}
          >
            <Clock className="h-3 w-3" />
            Actives
          </button>
          <button
            onClick={() => setTimeFilter('future')}
            className={cn(
              'flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors',
              timeFilter === 'future'
                ? 'bg-accent-cyan/10 text-accent-cyan'
                : 'text-muted hover:text-white'
            )}
          >
            <CalendarClock className="h-3 w-3" />
            A venir
          </button>
          <button
            onClick={() => setTimeFilter('all')}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              timeFilter === 'all'
                ? 'bg-accent-cyan/10 text-accent-cyan'
                : 'text-muted hover:text-white'
            )}
          >
            Tout
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted text-sm">Chargement...</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-muted">
            {routeFilter === 'favorites'
              ? 'Aucune alerte pour vos lignes favorites'
              : timeFilter === 'future'
                ? 'Aucune alerte a venir'
                : timeFilter === 'active'
                  ? 'Aucune alerte active'
                  : 'Aucune alerte'}
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
                    <span className="text-xs text-muted shrink-0 whitespace-nowrap">
                      {new Date(alert.activePeriodStart * 1000).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric' })}{' '}
                      {formatTime(alert.activePeriodStart)}
                    </span>
                  )}
                </div>
                {/* Route badges */}
                {alert.routeShortNames && alert.routeShortNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {alert.routeShortNames.map((name) => (
                      <span
                        key={name}
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[10px] font-bold',
                          favRouteShortNames.has(name)
                            ? 'bg-accent-cyan/20 text-accent-cyan'
                            : 'bg-white/10 text-muted'
                        )}
                      >
                        {name}
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
