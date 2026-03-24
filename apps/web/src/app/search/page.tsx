'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronRight, MapPin, Check, Plus, Star, Bus, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore } from '@/store/favorites'
import { cn } from '@/lib/utils'
import type { GtfsRoute, GtfsStop, RouteDirection, StopRoute, VehiclePosition } from '@buswave/shared'

// ── Line search with expandable stop picker ───────────────────────────────

function StopRow({
  stop,
  routeId,
  routeShortName,
  selected,
  onToggle,
}: {
  stop: GtfsStop
  routeId: string
  routeShortName: string
  selected: boolean
  onToggle: () => void
}) {
  const isFav = useFavoritesStore((s) => s.isFavorite(stop.stop_id, routeId))
  return (
    <button
      onClick={onToggle}
      disabled={isFav}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isFav
          ? 'opacity-50 cursor-default'
          : selected
          ? 'bg-accent-cyan/10'
          : 'hover:bg-white/5'
      )}
    >
      <div className={cn(
        'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
        isFav
          ? 'border-on-time bg-on-time/20'
          : selected
          ? 'border-accent-cyan bg-accent-cyan'
          : 'border-border'
      )}>
        {isFav
          ? <Star className="h-2.5 w-2.5 text-on-time" />
          : selected && <Check className="h-2.5 w-2.5 text-[#0A0E17]" />
        }
      </div>
      <MapPin className="h-3.5 w-3.5 text-muted shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white truncate">{stop.stop_name}</span>
        {stop.stop_code && <span className="text-xs text-muted font-mono">#{stop.stop_code}</span>}
      </span>
      {isFav && <span className="text-xs text-on-time ml-auto shrink-0">Déjà favori</span>}
    </button>
  )
}

function LiveDot() {
  return <span className="inline-block w-2 h-2 rounded-full bg-on-time animate-pulse shrink-0" title="En service" />
}

function LineCard({ route, isActive }: { route: GtfsRoute; isActive: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [activeDir, setActiveDir] = useState<0 | 1>(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const addFavorite = useFavoritesStore((s) => s.addFavorite)

  const { data: directions = [], isLoading } = useQuery({
    queryKey: ['route-stops', route.route_id],
    queryFn: () => api.routeStops(route.route_id),
    enabled: expanded,
    staleTime: 60_000,
  })

  const { data: vehicles = [] } = useQuery({
    queryKey: ['route-vehicles-search', route.route_id],
    queryFn: () => api.vehicles(route.route_id),
    enabled: expanded,
    refetchInterval: 10_000,
    staleTime: 5_000,
  })

  const currentDir = directions.find((d) => d.directionId === activeDir) ?? directions[0]

  // Map stopId → buses currently heading to that stop, filtered to current direction
  const busesAtStop = useMemo<Map<string, VehiclePosition[]>>(() => {
    const map = new Map<string, VehiclePosition[]>()
    if (!currentDir) return map
    const dirStopIds = new Set(currentDir.stops.map((s) => s.stop_id))
    for (const v of vehicles) {
      if (v.stopId && dirStopIds.has(v.stopId)) {
        const arr = map.get(v.stopId) ?? []
        arr.push(v)
        map.set(v.stopId, arr)
      }
    }
    return map
  }, [vehicles, currentDir])

  function toggleStop(stopId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(stopId) ? next.delete(stopId) : next.add(stopId)
      return next
    })
  }

  function addSelected() {
    if (!currentDir) return
    const stops = currentDir.stops.filter((s) => selected.has(s.stop_id))
    for (const stop of stops) {
      addFavorite({
        stopId: stop.stop_id,
        routeId: route.route_id,
        userId: null,
        label: `${route.route_short_name} · ${stop.stop_name}`,
      })
    }
    setSelected(new Set())
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Line header — click to expand */}
      <button
        onClick={() => { setExpanded((v) => !v); setSelected(new Set()) }}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
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
        <div className="flex items-center gap-2 shrink-0">
          {isActive && <LiveDot />}
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted" />
            : <ChevronRight className="h-4 w-4 text-muted" />
          }
        </div>
      </button>

      {/* Expanded stops */}
      {expanded && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-muted text-sm">Chargement…</div>
          ) : directions.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted text-sm">Aucun arrêt trouvé</div>
          ) : (
            <>
              {/* Direction tabs */}
              {directions.length > 1 && (
                <div className="flex border-b border-border">
                  {directions.map((dir) => (
                    <button
                      key={dir.directionId}
                      onClick={() => { setActiveDir(dir.directionId); setSelected(new Set()) }}
                      className={cn(
                        'flex-1 px-3 py-2 text-xs font-medium transition-colors',
                        activeDir === dir.directionId
                          ? 'text-accent-cyan border-b-2 border-accent-cyan'
                          : 'text-muted hover:text-white'
                      )}
                    >
                      → {dir.headsign}
                    </button>
                  ))}
                </div>
              )}

              {/* Stop list — max height with scroll */}
              <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                {(currentDir?.stops ?? []).map((stop) => {
                  const buses = busesAtStop.get(stop.stop_id) ?? []
                  return (
                    <div key={stop.stop_id}>
                      {/* Bus indicators for buses heading to this stop */}
                      {buses.map((v) => (
                        <div
                          key={v.vehicleId}
                          className="flex items-center gap-2 px-4 py-1.5 bg-accent-cyan/5 border-b border-border/50"
                        >
                          <div className="w-4 h-4 rounded-full bg-accent-cyan/20 flex items-center justify-center shrink-0">
                            <Bus className="h-2.5 w-2.5 text-accent-cyan" />
                          </div>
                          <span className="text-xs text-accent-cyan font-medium">Bus {v.vehicleId}</span>
                          {v.speed != null && (
                            <span className="text-xs text-muted ml-auto">{Math.round(v.speed * 3.6)} km/h</span>
                          )}
                        </div>
                      ))}
                      <StopRow
                        stop={stop}
                        routeId={route.route_id}
                        routeShortName={route.route_short_name}
                        selected={selected.has(stop.stop_id)}
                        onToggle={() => toggleStop(stop.stop_id)}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Add selected button */}
              {selected.size > 0 && (
                <div className="p-3 border-t border-border">
                  <button
                    onClick={addSelected}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent-cyan/10 py-2.5 text-sm font-medium text-accent-cyan hover:bg-accent-cyan/20 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Ajouter {selected.size} arrêt{selected.size > 1 ? 's' : ''} aux favoris
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stop search ───────────────────────────────────────────────────────────

function StopRouteRow({ stop, route, isActive }: { stop: GtfsStop; route: StopRoute; isActive: boolean }) {
  const addFavorite = useFavoritesStore((s) => s.addFavorite)
  const isFav = useFavoritesStore((s) => s.isFavorite(stop.stop_id, route.route_id))

  return (
    <div className={cn(
      'flex items-center justify-between px-4 py-2.5 gap-3',
      isFav ? 'opacity-60' : 'hover:bg-white/5'
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <span className="min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-xs font-bold text-accent-cyan shrink-0">
          {route.route_short_name}
        </span>
        {isActive && <LiveDot />}
        <span className="text-sm text-white truncate">{route.route_long_name || route.headsign}</span>
      </div>
      <button
        onClick={() =>
          addFavorite({
            stopId: stop.stop_id,
            routeId: route.route_id,
            userId: null,
            label: `${route.route_short_name} · ${stop.stop_name}`,
          })
        }
        disabled={isFav}
        className={cn(
          'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0',
          isFav
            ? 'bg-on-time/10 text-on-time cursor-default'
            : 'bg-accent-cyan/10 text-accent-cyan hover:bg-accent-cyan/20'
        )}
      >
        {isFav ? <><Check className="h-3 w-3" /> Ajouté</> : <><Plus className="h-3 w-3" /> Favori</>}
      </button>
    </div>
  )
}

function StopSearchResult({ stop, activeRouteIds }: { stop: GtfsStop; activeRouteIds: Set<string> }) {
  const [expanded, setExpanded] = useState(false)

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['stop-routes', stop.stop_id],
    queryFn: () => api.stopRoutes(stop.stop_id),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Stop header — click to expand */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <MapPin className="h-4 w-4 text-muted shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{stop.stop_name}</p>
            {stop.stop_code && <p className="text-xs text-muted">Code {stop.stop_code}</p>}
          </div>
        </div>
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted shrink-0" />
        }
      </button>

      {/* Expanded: list of lines serving this stop */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border/50">
          {isLoading ? (
            <div className="px-4 py-4 text-center text-muted text-sm">Chargement…</div>
          ) : routes.length === 0 ? (
            <div className="px-4 py-4 text-center text-muted text-sm">Aucune ligne trouvée</div>
          ) : (
            routes.map((route) => (
              <StopRouteRow key={`${route.route_id}:${route.direction_id}`} stop={stop} route={route} isActive={activeRouteIds.has(route.route_id)} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

type Mode = 'ligne' | 'arret'

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="h-16 rounded-xl bg-card animate-pulse" />}>
      <SearchPageInner />
    </Suspense>
  )
}

function SearchPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [mode, setMode] = useState<Mode>((searchParams.get('mode') as Mode) ?? 'ligne')
  const [query, setQuery] = useState(searchParams.get('q') ?? '')

  // Sync state to URL without adding history entries
  useEffect(() => {
    const params = new URLSearchParams()
    if (mode !== 'ligne') params.set('mode', mode)
    if (query) params.set('q', query)
    const search = params.toString()
    router.replace(search ? `/search?${search}` : '/search', { scroll: false })
  }, [mode, query, router])

  const { data: routes = [], isLoading: loadingRoutes } = useQuery({
    queryKey: ['routes-search', query],
    queryFn: () => api.searchRoutes(query),
    enabled: mode === 'ligne' && query.length >= 2,
    staleTime: 5_000,
  })

  const { data: stops = [], isLoading: loadingStops } = useQuery({
    queryKey: ['stops-search', query],
    queryFn: () => api.searchStops(query),
    enabled: mode === 'arret' && query.length >= 2,
    staleTime: 5_000,
  })

  const { data: allVehicles = [] } = useQuery({
    queryKey: ['all-vehicles-search'],
    queryFn: () => api.allVehicles(),
    refetchInterval: 30_000,
    staleTime: 20_000,
    enabled: query.length >= 2,
  })

  const activeRouteIds = useMemo(
    () => new Set(allVehicles.map((v) => v.routeId)),
    [allVehicles]
  )

  const isLoading = mode === 'ligne' ? loadingRoutes : loadingStops
  const placeholder = mode === 'ligne' ? 'Numéro ou nom de ligne…' : 'Nom d\'arrêt…'

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-4">Recherche</h1>

      {/* Mode tabs */}
      <div className="flex rounded-xl border border-border bg-card p-1 mb-4">
        {(['ligne', 'arret'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setQuery(mode === m ? query : '') }}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              mode === m
                ? 'bg-accent-cyan/10 text-accent-cyan'
                : 'text-muted hover:text-white'
            )}
          >
            {m === 'ligne' ? 'Par ligne' : 'Par arrêt'}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-white placeholder:text-muted focus:border-accent-cyan focus:outline-none"
          autoFocus
        />
      </div>

      {/* Results */}
      {query.length >= 2 ? (
        <div className="space-y-2">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-card animate-pulse" />
              ))
            : mode === 'ligne'
            ? routes.length === 0
              ? <p className="text-muted text-center py-8">Aucun résultat pour « {query} »</p>
              : routes.map((route) => <LineCard key={route.route_id} route={route} isActive={activeRouteIds.has(route.route_id)} />)
            : stops.length === 0
            ? <p className="text-muted text-center py-8">Aucun arrêt trouvé pour « {query} »</p>
            : stops.map((stop) => <StopSearchResult key={stop.stop_id} stop={stop} activeRouteIds={activeRouteIds} />)
          }
        </div>
      ) : (
        <p className="text-muted text-center py-8 text-sm">
          Tapez au moins 2 caractères pour rechercher
        </p>
      )}
    </div>
  )
}
