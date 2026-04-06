'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, MapPin, Navigation, Loader2, ChevronDown, ChevronUp, Bus } from 'lucide-react'
import { api } from '@/lib/api'
import { useFavoritesStore } from '@/store/favorites'
import { useFavoritesActions } from '@/hooks/useFavoritesActions'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Pill } from '@/components/ui/Pill'
import { Button } from '@/components/ui/Button'
import type { GtfsStop, StopWithHeadsigns } from '@buswave/shared'

type Mode = 'nearby' | 'stop' | 'line'

const MODES: { key: Mode; label: string; icon: typeof Search }[] = [
  { key: 'nearby', label: 'Autour', icon: Navigation },
  { key: 'stop', label: 'Arrêt', icon: MapPin },
  { key: 'line', label: 'Ligne', icon: Bus },
]

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="h-16 skeleton rounded-3xl" />}>
      <SearchPageInner />
    </Suspense>
  )
}

function SearchPageInner() {
  const [mode, setMode] = useState<Mode>('nearby')
  const [query, setQuery] = useState('')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-ink leading-tight">Trouver</h1>
        <p className="text-ink2 font-medium">Ajoute un arrêt à tes favoris</p>
      </div>

      {/* Mode pills */}
      <div className="flex gap-2">
        {MODES.map(({ key, label, icon: Icon }) => {
          const active = mode === key
          return (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-pill py-3 font-bold text-sm pressable transition-all',
                active
                  ? 'bg-primary-600 text-white shadow-pop'
                  : 'bg-surface border-2 border-line text-ink2'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.5} />
              {label}
            </button>
          )
        })}
      </div>

      {/* Search input (for stop/line modes) */}
      {mode !== 'nearby' && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink3" strokeWidth={2.5} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'stop' ? 'Nom de l\'arrêt...' : 'Numéro de ligne...'}
            className="w-full h-14 rounded-3xl border-2 border-line bg-surface pl-12 pr-5 text-lg font-semibold text-ink placeholder:text-ink3 focus:outline-none focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            autoFocus
          />
        </div>
      )}

      {/* Content */}
      {mode === 'nearby' ? <NearbyTab /> : mode === 'stop' ? <StopSearchTab query={query} /> : <LineSearchTab query={query} />}
    </div>
  )
}

// ── Nearby tab ─────────────────────────────────────────────────────────

function NearbyTab() {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [requesting, setRequesting] = useState(true)

  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non supportée')
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
            ? 'Autorise la localisation dans ton navigateur'
            : 'Impossible de te localiser'
        )
        setRequesting(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    )
  }, [])

  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['nearby-stops', coords?.lat, coords?.lon],
    queryFn: () => api.nearbyStops(coords!.lat, coords!.lon, 12),
    enabled: !!coords,
    staleTime: 30_000,
  })

  if (requesting) {
    return (
      <div className="flex flex-col items-center py-12 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        <p className="text-ink2 font-bold">Localisation en cours...</p>
      </div>
    )
  }

  if (geoError) {
    return (
      <Card variant="pop" className="text-center py-10">
        <Navigation className="h-12 w-12 text-coral-400 mx-auto mb-3" strokeWidth={2} />
        <p className="text-ink font-bold">{geoError}</p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 skeleton rounded-3xl" />
        ))}
      </div>
    )
  }

  if (stops.length === 0) {
    return <p className="text-ink2 text-center py-8 font-bold">Aucun arrêt à proximité</p>
  }

  return (
    <div className="space-y-3">
      {stops.map((stop) => (
        <StopItem key={stop.stop_id} stop={stop} />
      ))}
    </div>
  )
}

// ── Stop search tab ─────────────────────────────────────────────────────

function StopSearchTab({ query }: { query: string }) {
  const { data: stops = [], isLoading } = useQuery({
    queryKey: ['stops-search', query],
    queryFn: () => api.searchStops(query),
    enabled: query.length >= 1,
    staleTime: 5_000,
  })

  if (query.length === 0) {
    return <EmptyHint text="Tape le nom d'un arrêt pour commencer" />
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 skeleton rounded-3xl" />
        ))}
      </div>
    )
  }

  if (stops.length === 0) {
    return <p className="text-ink2 text-center py-8 font-bold">Aucun résultat</p>
  }

  return (
    <div className="space-y-3">
      {stops.map((stop) => (
        <StopItem key={stop.stop_id} stop={stop} headsigns={stop.headsigns} />
      ))}
    </div>
  )
}

// ── Line search tab ─────────────────────────────────────────────────────

function LineSearchTab({ query }: { query: string }) {
  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['routes-search', query],
    queryFn: () => api.searchRoutes(query),
    enabled: query.length >= 1,
    staleTime: 5_000,
  })

  if (query.length === 0) {
    return <EmptyHint text="Tape un numéro de ligne (ex: 42)" />
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 skeleton rounded-3xl" />
        ))}
      </div>
    )
  }

  if (routes.length === 0) {
    return <p className="text-ink2 text-center py-8 font-bold">Aucune ligne trouvée</p>
  }

  return (
    <div className="space-y-3">
      {routes.map((route) => (
        <LineCard key={route.route_id} route={route} />
      ))}
    </div>
  )
}

// ── Stop item with expandable routes ─────────────────────────────────────

function StopItem({ stop, headsigns }: { stop: GtfsStop | StopWithHeadsigns; headsigns?: string[] }) {
  const [expanded, setExpanded] = useState(false)

  const { data: routes = [], isLoading } = useQuery({
    queryKey: ['stop-routes', stop.stop_id],
    queryFn: () => api.stopRoutes(stop.stop_id),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <Card variant="pop" className="p-0 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-5 pressable text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 shrink-0">
            <MapPin className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink truncate">{stop.stop_name}</p>
            {headsigns && headsigns.length > 0 && (
              <p className="text-xs text-ink2 font-medium truncate">→ {headsigns.join(', ')}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-ink2">
          {expanded ? <ChevronUp className="h-5 w-5" strokeWidth={2.5} /> : <ChevronDown className="h-5 w-5" strokeWidth={2.5} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t-2 border-line bg-bg px-4 py-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            </div>
          ) : routes.length === 0 ? (
            <p className="text-center text-ink2 font-bold py-3 text-sm">Aucune ligne</p>
          ) : (
            <div className="space-y-2">
              {routes.map((r) => (
                <ToggleFavRow
                  key={`${r.route_id}:${r.direction_id}`}
                  stopId={stop.stop_id}
                  stopName={stop.stop_name}
                  routeId={r.route_id}
                  routeShortName={r.route_short_name}
                  headsign={r.headsign || r.route_long_name}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Line card with expandable stops list ─────────────────────────────────

function LineCard({ route }: { route: { route_id: string; route_short_name: string; route_long_name: string } }) {
  const [expanded, setExpanded] = useState(false)

  const { data: directions = [], isLoading } = useQuery({
    queryKey: ['route-stops', route.route_id],
    queryFn: () => api.routeStops(route.route_id),
    enabled: expanded,
    staleTime: 60_000,
  })

  return (
    <Card variant="pop" className="p-0 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-5 pressable text-left"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Pill variant="primary" size="lg" className="shrink-0 !w-14 !h-11">
            {route.route_short_name}
          </Pill>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-ink truncate">{route.route_long_name}</p>
            <p className="text-xs text-ink2 font-medium">Ligne TEC</p>
          </div>
        </div>
        <div className="shrink-0 text-ink2">
          {expanded ? <ChevronUp className="h-5 w-5" strokeWidth={2.5} /> : <ChevronDown className="h-5 w-5" strokeWidth={2.5} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t-2 border-line bg-bg px-4 py-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
            </div>
          ) : directions.length === 0 ? (
            <p className="text-center text-ink2 font-bold py-3 text-sm">Pas d'arrêts</p>
          ) : (
            <div className="space-y-3">
              {directions.map((dir) => (
                <div key={dir.directionId}>
                  <p className="text-xs font-extrabold text-primary-700 uppercase mb-1.5 px-1">
                    → {dir.headsign}
                  </p>
                  <div className="space-y-1">
                    {dir.stops.map((s) => (
                      <ToggleFavRow
                        key={`${dir.directionId}:${s.stop_id}`}
                        stopId={s.stop_id}
                        stopName={s.stop_name}
                        routeId={route.route_id}
                        routeShortName={route.route_short_name}
                        headsign={dir.headsign}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Toggle favorite row ──────────────────────────────────────────────────

function ToggleFavRow({
  stopId,
  stopName,
  routeId,
  routeShortName,
  headsign,
}: {
  stopId: string
  stopName: string
  routeId: string
  routeShortName: string
  headsign: string
}) {
  const { addFavorite, removeFavorite } = useFavoritesActions()
  const isFav = useFavoritesStore((s) => s.isFavorite(stopId, routeId))

  const handleToggle = () => {
    if (isFav) {
      removeFavorite(stopId, routeId)
    } else {
      addFavorite({
        stopId,
        routeId,
        userId: null,
        label: `${routeShortName} · ${stopName}`,
      })
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'w-full flex items-center gap-3 rounded-2xl p-3 pressable text-left transition-all',
        isFav
          ? 'bg-lime-100 border-2 border-lime-400'
          : 'bg-surface border-2 border-line hover:border-primary-300'
      )}
    >
      <Pill variant={isFav ? 'lime' : 'primary'} size="md" className="shrink-0 !w-12 !h-9">
        {routeShortName}
      </Pill>
      <span className="text-sm text-ink truncate flex-1 min-w-0 font-semibold">{headsign}</span>
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border-2 transition-all',
          isFav ? 'bg-lime-500 text-white border-lime-500' : 'bg-transparent text-ink2 border-line'
        )}
      >
        {isFav ? '✓' : '+'}
      </div>
    </button>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-100 text-primary-600">
        <Search className="h-8 w-8" strokeWidth={2.5} />
      </div>
      <p className="text-ink2 font-bold text-center px-4">{text}</p>
    </div>
  )
}
