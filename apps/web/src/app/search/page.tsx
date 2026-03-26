'use client'

import { useState, useMemo, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronRight, MapPin, Check, Plus, Star, Bus, ArrowRight, Navigation, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore } from '@/store/favorites'
import { useFavoritesActions } from '@/hooks/useFavoritesActions'
import { cn } from '@/lib/utils'
import type { GtfsRoute, GtfsStop, RouteDirection, StopRoute, VehiclePosition } from '@buswave/shared'

// ── Shared components ────────────────────────────────────────────────────

function LiveDot() {
  return <span className="inline-block w-2 h-2 rounded-full bg-on-time animate-pulse shrink-0" title="En service" />
}

// ── Nearby stop row — toggles favorite on click ─────────────────────────

function NearbyStopCard({ stop, activeRouteIds }: { stop: GtfsStop; activeRouteIds: Set<string> }) {
  const [expanded, setExpanded] = useState(false)

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['stop-routes', stop.stop_id],
    queryFn: () => api.stopRoutes(stop.stop_id),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <MapPin className="h-4 w-4 text-accent-cyan shrink-0" />
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

      {expanded && (
        <div className="border-t border-border divide-y divide-border/50">
          {isLoading ? (
            <div className="px-4 py-4 text-center text-muted text-sm">Chargement…</div>
          ) : routes.length === 0 ? (
            <div className="px-4 py-4 text-center text-muted text-sm">Aucune ligne trouvée</div>
          ) : (
            routes.map((route) => (
              <ToggleFavRow
                key={`${route.route_id}:${route.direction_id}`}
                stop={stop}
                routeId={route.route_id}
                routeShortName={route.route_short_name}
                routeLongName={route.route_long_name || route.headsign}
                isActive={activeRouteIds.has(route.route_id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/** A row that toggles favorite on/off instantly when clicked */
function ToggleFavRow({
  stop,
  routeId,
  routeShortName,
  routeLongName,
  isActive,
}: {
  stop: GtfsStop
  routeId: string
  routeShortName: string
  routeLongName: string
  isActive: boolean
}) {
  const { addFavorite, removeFavorite } = useFavoritesActions()
  const isFav = useFavoritesStore((s) => s.isFavorite(stop.stop_id, routeId))

  function handleToggle() {
    if (isFav) {
      removeFavorite(stop.stop_id, routeId)
    } else {
      addFavorite({
        stopId: stop.stop_id,
        routeId,
        userId: null,
        label: `${routeShortName} · ${stop.stop_name}`,
      })
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isFav ? 'bg-on-time/5' : 'hover:bg-white/5'
      )}
    >
      <div className={cn(
        'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
        isFav ? 'border-on-time bg-on-time' : 'border-border'
      )}>
        {isFav && <Check className="h-2.5 w-2.5 text-[#0A0E17]" />}
      </div>
      <span className="min-w-[2.5rem] rounded bg-accent-cyan/10 px-2 py-0.5 text-center text-xs font-bold text-accent-cyan shrink-0">
        {routeShortName}
      </span>
      {isActive && <LiveDot />}
      <span className="text-sm text-white truncate flex-1 min-w-0">{routeLongName}</span>
      {isFav && <Star className="h-3 w-3 text-on-time shrink-0" />}
    </button>
  )
}

// ── Line search with expandable stop picker ─────────────────────────────

function StopRow({
  stop,
  routeId,
  routeShortName,
}: {
  stop: GtfsStop
  routeId: string
  routeShortName: string
}) {
  const { addFavorite, removeFavorite } = useFavoritesActions()
  const isFav = useFavoritesStore((s) => s.isFavorite(stop.stop_id, routeId))

  function handleToggle() {
    if (isFav) {
      removeFavorite(stop.stop_id, routeId)
    } else {
      addFavorite({
        stopId: stop.stop_id,
        routeId,
        userId: null,
        label: `${routeShortName} · ${stop.stop_name}`,
      })
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
        isFav ? 'bg-on-time/5' : 'hover:bg-white/5'
      )}
    >
      <div className={cn(
        'w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors',
        isFav ? 'border-on-time bg-on-time' : 'border-border'
      )}>
        {isFav && <Check className="h-2.5 w-2.5 text-[#0A0E17]" />}
      </div>
      <MapPin className="h-3.5 w-3.5 text-muted shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-white truncate">{stop.stop_name}</span>
        {stop.stop_code && <span className="text-xs text-muted font-mono">#{stop.stop_code}</span>}
      </span>
      {isFav && <Star className="h-3 w-3 text-on-time shrink-0" />}
    </button>
  )
}

function LineCard({ route, isActive }: { route: GtfsRoute; isActive: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [activeDir, setActiveDir] = useState<0 | 1>(0)

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

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
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

      {expanded && (
        <div className="border-t border-border">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-muted text-sm">Chargement…</div>
          ) : directions.length === 0 ? (
            <div className="px-4 py-6 text-center text-muted text-sm">Aucun arrêt trouvé</div>
          ) : (
            <>
              {directions.length > 1 && (
                <div className="flex border-b border-border">
                  {directions.map((dir) => (
                    <button
                      key={dir.directionId}
                      onClick={() => setActiveDir(dir.directionId)}
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

              <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
                {(currentDir?.stops ?? []).map((stop) => {
                  const buses = busesAtStop.get(stop.stop_id) ?? []
                  return (
                    <div key={stop.stop_id}>
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
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Stop search ──────────────────────────────────────────────────────────

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

      {expanded && (
        <div className="border-t border-border divide-y divide-border/50">
          {isLoading ? (
            <div className="px-4 py-4 text-center text-muted text-sm">Chargement…</div>
          ) : routes.length === 0 ? (
            <div className="px-4 py-4 text-center text-muted text-sm">Aucune ligne trouvée</div>
          ) : (
            routes.map((route) => (
              <ToggleFavRow
                key={`${route.route_id}:${route.direction_id}`}
                stop={stop}
                routeId={route.route_id}
                routeShortName={route.route_short_name}
                routeLongName={route.route_long_name || route.headsign}
                isActive={activeRouteIds.has(route.route_id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── Nearby tab content ───────────────────────────────────────────────────

function NearbyTab({ activeRouteIds }: { activeRouteIds: Set<string> }) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non supportée par ce navigateur.')
      setRequesting(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setRequesting(false)
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Accès à la localisation refusé. Autorisez-la dans les paramètres.'
            : 'Impossible de déterminer votre position.'
        )
        setRequesting(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['nearby-stops', coords?.lat, coords?.lon],
    queryFn: () => api.nearbyStops(coords!.lat, coords!.lon, 10),
    enabled: !!coords,
    staleTime: 30_000,
  })

  if (requesting) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-accent-cyan" />
        <p className="text-sm text-muted">Localisation en cours…</p>
      </div>
    )
  }

  if (geoError) {
    return (
      <div className="flex flex-col items-center py-12 gap-2">
        <Navigation className="h-6 w-6 text-muted" />
        <p className="text-sm text-muted text-center">{geoError}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-card animate-pulse" />
        ))}
      </div>
    )
  }

  if (stops.length === 0) {
    return <p className="text-muted text-center py-8">Aucun arrêt trouvé à proximité</p>
  }

  return (
    <div className="space-y-2">
      {stops.map((stop) => (
        <NearbyStopCard key={stop.stop_id} stop={stop} activeRouteIds={activeRouteIds} />
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

type Mode = 'nearby' | 'ligne' | 'arret'

let _cachedMode: Mode = 'nearby'
let _cachedQuery = ''

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

  const [mode, setMode] = useState<Mode>((searchParams.get('mode') as Mode) ?? _cachedMode)
  const [query, setQuery] = useState(searchParams.get('q') ?? _cachedQuery)

  useEffect(() => {
    _cachedMode = mode
    _cachedQuery = query
    const params = new URLSearchParams()
    if (mode !== 'nearby') params.set('mode', mode)
    if (query && mode !== 'nearby') params.set('q', query)
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
        {([
          { key: 'nearby' as Mode, label: 'Proches' },
          { key: 'ligne' as Mode, label: 'Lignes' },
          { key: 'arret' as Mode, label: 'Arrêts' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setMode(key); if (key === 'nearby') setQuery('') }}
            className={cn(
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
              mode === key
                ? 'bg-accent-cyan/10 text-accent-cyan'
                : 'text-muted hover:text-white'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search input — only for ligne and arret modes */}
      {mode !== 'nearby' && (
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
      )}

      {/* Results */}
      {mode === 'nearby' ? (
        <NearbyTab activeRouteIds={activeRouteIds} />
      ) : query.length >= 2 ? (
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
